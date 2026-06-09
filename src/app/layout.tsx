import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ChatwootWidget } from "@/components/marketing/chatwoot-widget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inboxy — Atenda, venda e agende em todos os canais",
  description:
    "Inbox unificado para WhatsApp, Telegram, SMS, e-mail e chat no site. Agente de IA com vendas Stripe e agendamento Cal.com — tudo na mesma conversa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ChatwootWidget />
      </body>
    </html>
  );
}
