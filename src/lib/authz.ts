import type { MemberRole } from "@/domain/entities/organization-member";

export type OrgCapability =
  | "write_inbox"
  | "write_contacts"
  | "write_leads"
  | "manage_pipeline"
  | "manage_tags"
  | "manage_team"
  | "manage_channels"
  | "manage_integrations"
  | "manage_agent"
  | "manage_kb"
  | "manage_billing";

/** Capabilities that allow org owner even without membership role match (admin-or-owner). */
export const OWNER_OR_ADMIN_CAPS: ReadonlySet<OrgCapability> = new Set([
  "manage_kb",
  "manage_billing",
]);

const ADMIN_CAPS: OrgCapability[] = [
  "write_inbox",
  "write_contacts",
  "write_leads",
  "manage_pipeline",
  "manage_tags",
  "manage_team",
  "manage_channels",
  "manage_integrations",
  "manage_agent",
  "manage_kb",
  "manage_billing",
];

const AGENT_CAPS: OrgCapability[] = ["write_inbox", "write_contacts", "write_leads"];

const VIEWER_CAPS: OrgCapability[] = [];

export const ROLE_CAPABILITIES: Record<MemberRole, readonly OrgCapability[]> = {
  admin: ADMIN_CAPS,
  agent: AGENT_CAPS,
  viewer: VIEWER_CAPS,
};

export function hasCapability(role: MemberRole | null | undefined, capability: OrgCapability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role].includes(capability);
}

/** Alias for UI — same as hasCapability. */
export function can(role: MemberRole | null | undefined, capability: OrgCapability): boolean {
  return hasCapability(role, capability);
}
