/** Fixed label/tag rules injected when the manage-conversation-tags tool is enabled. */
export function buildConversationLabelSystemInstructions(availableLabels: string[]): string[] {
  const lines = [
    `- Se o prompt da organização (seção inicial deste system prompt) definir regras de tags de lead/conversa, aplique-as e chame manage_conversation_tags quando os critérios forem atendidos.`,
    `- Chame manage_conversation_tags IMEDIATAMENTE quando identificar o critério — não espere o fim da conversa.`,
    `- Use SOMENTE tags que existem na organização. Nunca invente nomes de tags.`,
    `- Se o prompt pedir remoção ou troca de tag (ex.: "remova 'quente' quando aplicar 'frio'"), use action "remove" para remover primeiro, depois "add" para a nova.`,
    `- Aplicar tag não substitui transfer_to_human — são ações independentes.`,
  ];

  if (availableLabels.length > 0) {
    lines.push(
      `- Tags válidas nesta organização: ${availableLabels.map((l) => `"${l}"`).join(", ")}.`,
    );
  } else {
    lines.push(
      `- Nenhuma tag foi criada nesta organização ainda. Crie tags em Ajustes → Tags antes de aplicá-las.`,
    );
  }

  return lines;
}
