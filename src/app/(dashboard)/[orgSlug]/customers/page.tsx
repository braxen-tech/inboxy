"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Download, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Customer {
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
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslations<"customers">> }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    active: { label: t("statusActive"), className: "bg-green-500/15 text-green-700 dark:text-green-400" },
    pending: { label: t("statusPending"), className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    canceled: { label: t("statusCanceled"), className: "bg-red-500/15 text-red-700 dark:text-red-400" },
    refunded: { label: t("statusRefunded"), className: "bg-gray-500/15 text-gray-700 dark:text-gray-400" },
  };

  const s = statusMap[status] ?? statusMap.active;
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function CustomersPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const t = useTranslations("customers");
  const tc = useTranslations("common");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState("lastInteraction");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const limit = 50;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortBy,
        order: sortOrder,
      });

      if (search) params.append("search", search);
      if (status) params.append("status", status);

      const response = await fetch(`/api/customers/${orgSlug}?${params}`);
      const data: CustomersResponse = await response.json();

      setCustomers(data.customers);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, page, search, status, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "10000", // Export max 10k
        sort: "lastInteraction",
        order: "desc",
      });

      if (search) params.append("search", search);
      if (status) params.append("status", status);

      const response = await fetch(`/api/customers/${orgSlug}?${params}`);
      const data: CustomersResponse = await response.json();

      // Build CSV
      const headers = [
        t("name"),
        t("email"),
        t("productsCount"),
        t("coursesCount"),
        t("purchases"),
        t("totalValue"),
        t("status"),
        t("joined"),
        t("lastPurchase"),
      ];

      const rows = data.customers.map((c) => [
        c.name || "",
        c.email,
        c.productPurchaseCount,
        c.courseEnrollmentCount,
        c.totalPurchases,
        c.totalValueBrl.toString(),
        c.status,
        formatDate(c.firstInteractionAt),
        formatDate(c.lastInteractionAt),
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
      ].join("\n");

      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `clientes-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  const hasMore = page * limit < total;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="size-4" />
          {t("export")}
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-xs">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            {t("search")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={tc("search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-1.5">
          <Button
            variant={status === "" ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus(""); setPage(1); }}
          >
            {t("filterAll")}
          </Button>
          <Button
            variant={status === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus("active"); setPage(1); }}
          >
            {t("filterActive")}
          </Button>
          <Button
            variant={status === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus("pending"); setPage(1); }}
          >
            {t("filterPending")}
          </Button>
        </div>

        <div className="flex gap-1.5">
          <Button
            variant={sortBy === "lastInteraction" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("lastInteraction")}
          >
            {t("lastPurchase")}
          </Button>
          <Button
            variant={sortBy === "totalValue" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("totalValue")}
          >
            {t("totalValue")}
          </Button>
        </div>
      </div>

      {!loading && customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">{t("empty")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("email")}</th>
                  <th className="px-4 py-3 text-center font-medium">{t("productsCount")}</th>
                  <th className="px-4 py-3 text-center font-medium">{t("coursesCount")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("totalValue")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("lastPurchase")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {tc("loading")}
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{customer.name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{customer.email}</td>
                      <td className="px-4 py-3 text-center">{customer.productPurchaseCount}</td>
                      <td className="px-4 py-3 text-center">{customer.courseEnrollmentCount}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatBrl(customer.totalValueBrl)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(customer.lastInteractionAt)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={customer.status} t={t} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("showing", { from: (page - 1) * limit + 1, to: Math.min(page * limit, total), total })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={!hasMore}
            >
              {t("nextPage")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
