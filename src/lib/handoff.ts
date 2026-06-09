/** Fixed handoff rules injected when Chatwoot is connected. Custom triggers live in the org system prompt. */
export function buildHandoffSystemInstructions(): string[] {
  return [
    `- SEMPRE que o cliente pedir explicitamente para falar com uma pessoa, atendente ou humano (ou recusar continuar com o assistente virtual), CHAME IMEDIATAMENTE a tool transfer_to_human. Esse gatilho é padrão do Inboxy e não pode ser ignorado.`,
    `- Além disso, se o prompt da organização (seção inicial deste system prompt) definir outras situações para transferir ao humano, aplique essas regras e chame transfer_to_human quando se encaixarem.`,
    `- Após transfer_to_human retornar sucesso, confirme ao cliente que um atendente assumirá em breve e NÃO continue tentando resolver o problema como bot.`,
    `- Não use transfer_to_human para dúvidas simples que você pode responder com a base de conhecimento, salvo se o prompt da organização ou um pedido explícito de humano exigir.`,
  ];
}
