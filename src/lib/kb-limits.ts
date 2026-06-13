import type { PlanId } from "@/lib/plans";

export interface KbPlanLimits {
  maxFiles: number;
  maxTotalBytes: number;
}

export const KB_PLAN_LIMITS: Record<PlanId, KbPlanLimits> = {
  starter: { maxFiles: 5, maxTotalBytes: 25 * 1024 * 1024 },
  professional: { maxFiles: 20, maxTotalBytes: 100 * 1024 * 1024 },
  business: { maxFiles: 50, maxTotalBytes: 500 * 1024 * 1024 },
};

export function getKbPlanLimits(plan: string | null | undefined): KbPlanLimits {
  const planId = (plan ?? "starter") as PlanId;
  return KB_PLAN_LIMITS[planId] ?? KB_PLAN_LIMITS.starter;
}
