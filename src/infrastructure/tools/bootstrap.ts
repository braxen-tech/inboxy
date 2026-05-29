import type { CalendarProvider, ProductCatalog, PaymentGateway } from "@/domain/ports";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryToolRegistry } from "./registry";
import { CheckCalendarAvailabilityTool } from "./check-calendar-availability";
import { BookCalendarAppointmentTool } from "./book-calendar-appointment";
import { SearchProductsTool } from "./stripe/search-products";
import { GetProductDetailsTool } from "./stripe/get-product-details";
import { AddToCartTool } from "./stripe/add-to-cart";
import { ViewCartTool } from "./stripe/view-cart";
import { RemoveFromCartTool } from "./stripe/remove-from-cart";
import { CreateCheckoutTool } from "./stripe/create-checkout";

interface ToolRegistryDeps {
  calendarProvider: CalendarProvider;
  productCatalog: ProductCatalog;
  paymentGateway: PaymentGateway;
  db: SupabaseClient;
  appUrl: string;
}

export function createToolRegistry(deps: ToolRegistryDeps): InMemoryToolRegistry {
  const registry = new InMemoryToolRegistry();

  registry.register(new CheckCalendarAvailabilityTool(deps.calendarProvider));
  registry.register(new BookCalendarAppointmentTool(deps.calendarProvider));

  registry.register(new SearchProductsTool(deps.productCatalog));
  registry.register(new GetProductDetailsTool(deps.productCatalog));
  registry.register(new AddToCartTool(deps.db, deps.productCatalog));
  registry.register(new ViewCartTool(deps.db));
  registry.register(new RemoveFromCartTool(deps.db));
  registry.register(new CreateCheckoutTool(deps.db, deps.paymentGateway, deps.appUrl));

  return registry;
}
