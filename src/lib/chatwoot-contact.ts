/** Fixed contact CRM rules injected when Chatwoot contact tool is enabled. Custom triggers live in the org system prompt. */
export function buildChatwootContactSystemInstructions(availableLabels: string[]): string[] {
  const lines = [
    `- Se o prompt da organização definir regras de CRM/contato (qualificação de lead, registro de dados), aplique-as e chame update_chatwoot_contact quando os critérios forem atendidos.`,
    `- Chame update_chatwoot_contact IMEDIATAMENTE ao coletar os dados exigidos — não espere o fim da conversa.`,
    `- Inclua name, email e/ou phone quando disponíveis; use contact_labels para tags de contato e note para um resumo objetivo (1–3 frases) visível só para agentes humanos.`,
    `- Use SOMENTE tags que existem no Chatwoot. Nunca invente nomes de tags.`,
    `- Prefira label_action "add" salvo se o prompt pedir remoção de tag.`,
    `- Atualizar contato não substitui transfer_to_human nem manage_conversation_labels — são ações independentes.`,
  ];

  if (availableLabels.length > 0) {
    lines.push(
      `- Tags válidas nesta conta Chatwoot: ${availableLabels.map((l) => `"${l}"`).join(", ")}.`,
    );
  } else {
    lines.push(
      `- Nenhuma tag foi encontrada na conta Chatwoot. Crie tags em Settings → Labels no Chatwoot antes de aplicá-las.`,
    );
  }

  return lines;
}
