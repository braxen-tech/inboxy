export type OrgId = string & { readonly __brand: "OrgId" };
export type ContactId = string & { readonly __brand: "ContactId" };
export type ConversationId = string & { readonly __brand: "ConversationId" };
export type MessageId = string & { readonly __brand: "MessageId" };
export type CorrelationId = string & { readonly __brand: "CorrelationId" };
export type ChannelId = string & { readonly __brand: "ChannelId" };
export type LeadId = string & { readonly __brand: "LeadId" };
export type PipelineId = string & { readonly __brand: "PipelineId" };
export type PipelineStageId = string & { readonly __brand: "PipelineStageId" };
export type TagId = string & { readonly __brand: "TagId" };
export type UserId = string & { readonly __brand: "UserId" };

export type PhoneNumber = string & { readonly __brand: "PhoneNumber" };
export type ChannelType = "whatsapp" | "instagram";

export function toOrgId(id: string): OrgId {
  return id as OrgId;
}

export function toContactId(id: string): ContactId {
  return id as ContactId;
}

export function toConversationId(id: string): ConversationId {
  return id as ConversationId;
}

export function toMessageId(id: string): MessageId {
  return id as MessageId;
}

export function toCorrelationId(id: string): CorrelationId {
  return id as CorrelationId;
}

export function toChannelId(id: string): ChannelId {
  return id as ChannelId;
}

export function toLeadId(id: string): LeadId {
  return id as LeadId;
}

export function toPipelineId(id: string): PipelineId {
  return id as PipelineId;
}

export function toPipelineStageId(id: string): PipelineStageId {
  return id as PipelineStageId;
}

export function toTagId(id: string): TagId {
  return id as TagId;
}

export function toUserId(id: string): UserId {
  return id as UserId;
}

export function toPhoneNumber(phone: string): PhoneNumber {
  return phone as PhoneNumber;
}
