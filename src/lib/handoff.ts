export interface HandoffAgentSummary {
  name: string;
  email?: string;
}

/** Fixed handoff rules injected when transfer_to_human tool is enabled. */
export function buildHandoffSystemInstructions(
  availableAgents: HandoffAgentSummary[] = [],
): string[] {
  const lines = [
    `- SEMPRE que o cliente pedir explicitamente para falar com uma pessoa, atendente ou humano (ou recusar continuar com o assistente virtual), CHAME IMEDIATAMENTE a tool transfer_to_human. Esse gatilho é padrão do Inboxy e não pode ser ignorado.`,
    `- Além disso, se o prompt da organização (seção inicial deste system prompt) definir outras situações para transferir ao humano, aplique essas regras e chame transfer_to_human quando se encaixarem.`,
    `- Se o prompt definir roteamento para atendentes específicos (ex.: financeiro → Ana, suporte → Carlos), chame transfer_to_human com assignee_name correspondente.`,
    `- Se o cliente pedir humano sem critério de roteamento, chame transfer_to_human SEM assignee_name (fila geral).`,
    `- Use SOMENTE nomes de atendentes da lista abaixo. Nunca invente nomes.`,
    `- Após transfer_to_human retornar sucesso, confirme ao cliente que um atendente assumirá em breve e NÃO continue tentando resolver o problema como bot.`,
    `- Não use transfer_to_human para dúvidas simples que você pode responder com a base de conhecimento, salvo se o prompt da organização ou um pedido explícito de humano exigir.`,
  ];

  if (availableAgents.length > 0) {
    lines.push(
      `- Atendentes disponíveis nesta organização: ${availableAgents.map((a) => `"${a.name}"`).join(", ")}.`,
    );
  } else {
    lines.push(
      `- Nenhum atendente humano foi encontrado na organização. Sem assignee_name, a conversa irá para a fila geral após handoff.`,
    );
  }

  return lines;
}
