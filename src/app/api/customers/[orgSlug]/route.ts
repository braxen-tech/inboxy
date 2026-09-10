import { NextRequest, NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.enum(["active", "pending", "canceled", "refunded"]).optional(),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(["totalValue", "lastInteraction", "name"]).default("lastInteraction"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

type Customer = {
  id: string;
  email: string;
  name: string | null;
  productPurchaseCount: number;
  courseEnrollmentCount: number;
  totalPurchases: number;
  totalValueBrl: number;
  lastInteractionAt: string;
  firstInteractionAt: string;
  purchaseTypes: ("product" | "course")[];
  status: "active" | "pending" | "canceled" | "refunded";
};

type GetCustomersResponse = {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  try {
    const supabase = await getServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { orgSlug } = await params;
    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const { page, limit, search, status, type, from, to, sort, order } = parsed.data;
    const offset = (page - 1) * limit;

    const db = getAdminClient();

    // Fetch product purchases — JOIN with digital_products for org filter and price
    const { data: productPurchases } = await db
      .from("digital_product_purchases")
      .select("id, end_user_id, buyer_email, buyer_name, status, purchased_at, digital_products!inner(price_brl, organization_id)")
      .eq("digital_products.organization_id", org.id)
      .order("purchased_at", { ascending: false });

    // Fetch course enrollments — JOIN with courses for org filter and price
    const { data: courseEnrollments } = await db
      .from("course_enrollments")
      .select("id, end_user_id, buyer_email, buyer_name, status, enrolled_at, courses!inner(title, price_brl, organization_id)")
      .eq("courses.organization_id", org.id)
      .order("enrolled_at", { ascending: false });

    // Consolidate customers by email (primary key for dedup)
    const customerMap = new Map<string, Customer>();

    productPurchases?.forEach((purchase) => {
      const email = purchase.buyer_email;
      if (!email) return;

      const key = email.toLowerCase();
      const product = purchase.digital_products as unknown as { price_brl: number | null } | null;
      const priceBrl = product?.price_brl ?? 0;
      const purchasedAt = purchase.purchased_at;

      const existing = customerMap.get(key);
      if (existing) {
        existing.productPurchaseCount += 1;
        existing.totalPurchases += 1;
        existing.totalValueBrl += priceBrl;
        if (new Date(purchasedAt) > new Date(existing.lastInteractionAt)) {
          existing.lastInteractionAt = purchasedAt;
          existing.status = purchase.status as Customer["status"];
        }
        if (new Date(purchasedAt) < new Date(existing.firstInteractionAt)) {
          existing.firstInteractionAt = purchasedAt;
        }
        if (!existing.purchaseTypes.includes("product")) {
          existing.purchaseTypes.push("product");
        }
        if (!existing.name && purchase.buyer_name) {
          existing.name = purchase.buyer_name;
        }
      } else {
        customerMap.set(key, {
          id: purchase.end_user_id || key,
          email,
          name: purchase.buyer_name || null,
          productPurchaseCount: 1,
          courseEnrollmentCount: 0,
          totalPurchases: 1,
          totalValueBrl: priceBrl,
          lastInteractionAt: purchasedAt,
          firstInteractionAt: purchasedAt,
          purchaseTypes: ["product"],
          status: purchase.status as Customer["status"],
        });
      }
    });

    courseEnrollments?.forEach((enrollment) => {
      const email = enrollment.buyer_email;
      if (!email) return;

      const key = email.toLowerCase();
      const course = enrollment.courses as unknown as { title: string; price_brl: number | null } | null;
      const priceBrl = course?.price_brl ?? 0;
      const enrolledAt = enrollment.enrolled_at;

      const existing = customerMap.get(key);
      if (existing) {
        existing.courseEnrollmentCount += 1;
        existing.totalPurchases += 1;
        existing.totalValueBrl += priceBrl;
        if (new Date(enrolledAt) > new Date(existing.lastInteractionAt)) {
          existing.lastInteractionAt = enrolledAt;
          existing.status = enrollment.status as Customer["status"];
        }
        if (new Date(enrolledAt) < new Date(existing.firstInteractionAt)) {
          existing.firstInteractionAt = enrolledAt;
        }
        if (!existing.purchaseTypes.includes("course")) {
          existing.purchaseTypes.push("course");
        }
        if (!existing.name && enrollment.buyer_name) {
          existing.name = enrollment.buyer_name;
        }
      } else {
        customerMap.set(key, {
          id: enrollment.end_user_id || key,
          email,
          name: enrollment.buyer_name || null,
          productPurchaseCount: 0,
          courseEnrollmentCount: 1,
          totalPurchases: 1,
          totalValueBrl: priceBrl,
          lastInteractionAt: enrolledAt,
          firstInteractionAt: enrolledAt,
          purchaseTypes: ["course"],
          status: enrollment.status as Customer["status"],
        });
      }
    });

    let customers = Array.from(customerMap.values());

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(lowerSearch) ||
          c.email.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by status
    if (status) {
      customers = customers.filter((c) => c.status === status);
    }

    // Filter by type
    if (type) {
      const types = type.split(",").map((t) => t.trim()) as ("product" | "course")[];
      customers = customers.filter((c) =>
        types.some((t) => c.purchaseTypes.includes(t))
      );
    }

    // Filter by date range
    if (from) {
      const fromDate = new Date(from);
      customers = customers.filter((c) => new Date(c.firstInteractionAt) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      customers = customers.filter((c) => new Date(c.lastInteractionAt) <= toDate);
    }

    // Sort
    customers.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sort) {
        case "totalValue":
          aVal = a.totalValueBrl;
          bVal = b.totalValueBrl;
          break;
        case "name":
          aVal = a.name || "";
          bVal = b.name || "";
          break;
        case "lastInteraction":
        default:
          aVal = new Date(a.lastInteractionAt).getTime();
          bVal = new Date(b.lastInteractionAt).getTime();
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return order === "asc" ? comparison : -comparison;
    });

    const total = customers.length;
    const hasMore = offset + limit < total;
    const paginatedCustomers = customers.slice(offset, offset + limit);

    const response: GetCustomersResponse = {
      customers: paginatedCustomers,
      total,
      page,
      limit,
      hasMore,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
