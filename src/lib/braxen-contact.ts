/** Same WhatsApp as braxen-web ContactForm */
export const BRAXEN_WHATSAPP_NUMBER = "5521973118404";

export function buildBraxenWhatsAppUrl(
  message = "Olá! Tenho interesse no Inboxy e gostaria de conversar com a equipe Braxen.",
): string {
  return `https://wa.me/${BRAXEN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
