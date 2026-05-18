export type OrgId = string & { readonly __brand: "OrgId" };
export type ContactId = string & { readonly __brand: "ContactId" };
export type ConversationId = string & { readonly __brand: "ConversationId" };
export type MessageId = string & { readonly __brand: "MessageId" };
export type CorrelationId = string & { readonly __brand: "CorrelationId" };

export type PhoneNumber = string & { readonly __brand: "PhoneNumber" };

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

export function toPhoneNumber(phone: string): PhoneNumber {
  return phone as PhoneNumber;
}
