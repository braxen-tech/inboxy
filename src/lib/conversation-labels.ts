/** Fixed label/tag rules injected when the manage-conversation-tags tool is enabled. */
export function buildConversationLabelSystemInstructions(availableLabels: string[]): string[] {
  const lines = [
    `- Se o prompt da organização definir regras de tags na conversa, chame manage_conversation_tags quando os critérios forem atendidos.`,
    `- Para classificar o lead no Kanban (pipeline), use manage_lead_tags no lead vinculado — não confundir com tags da conversa.`,
    `- Chame as ferramentas de tag IMEDIATAMENTE quando identificar o critério — não espere o fim da conversa.`,
    `- Use SOMENTE tags que existem na organização. Nunca invente nomes de tags.`,
    `- Se o prompt pedir remoção ou troca de tag, use action "remove" primeiro, depois "add" para a nova.`,
    `- Ferramentas de pipeline: list_pipeline_stages, list_leads, create_lead, update_lead, move_lead (ex.: "mova o lead para Proposta"), manage_lead_tags (ex.: "marque o lead como quente"). Prefira update_lead status=lost a delete_lead.`,
    `- Aplicar tag não substitui transfer_to_human — são ações independentes.`,
  ];

  if (availableLabels.length > 0) {
    lines.push(
      `- Tags válidas nesta organização: ${availableLabels.map((l) => `"${l}"`).join(", ")}.`,
    );
  } else {
    lines.push(
      `- Nenhuma tag foi criada nesta organização ainda. Crie tags em Configurações → Tags antes de aplicá-las.`,
    );
  }

  return lines;
}
