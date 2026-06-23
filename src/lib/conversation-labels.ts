/** Fixed label rules injected when Chatwoot label tool is enabled. Custom triggers live in the org system prompt. */
export function buildConversationLabelSystemInstructions(availableLabels: string[]): string[] {
  const lines = [
    `- Se o prompt da organização (seção inicial deste system prompt) definir regras de labels de lead/conversa, aplique-as e chame manage_conversation_labels quando os critérios forem atendidos.`,
    `- Chame manage_conversation_labels IMEDIATAMENTE quando identificar o critério — não espere o fim da conversa.`,
    `- Use SOMENTE labels que existem no Chatwoot. Nunca invente nomes de labels.`,
    `- Prefira action "add" salvo se o prompt pedir remoção ou troca de label (use action "remove").`,
    `- Aplicar label não substitui transfer_to_human — são ações independentes.`,
  ];

  if (availableLabels.length > 0) {
    lines.push(
      `- Labels válidas nesta conta Chatwoot: ${availableLabels.map((l) => `"${l}"`).join(", ")}.`,
    );
  } else {
    lines.push(
      `- Nenhuma label foi encontrada na conta Chatwoot. Crie labels em Settings → Labels no Chatwoot antes de aplicá-las.`,
    );
  }

  return lines;
}
