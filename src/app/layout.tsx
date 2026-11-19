import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inboxy — Atenda, venda e agende em todos os canais",
  description:
    "Agente IA para o WhatsApp, Instagram e site da sua empresa: responde, vende e agenda — e um painel que mostra tudo.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale === "pt" ? "pt-BR" : locale}
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
        <Script id="chatwoot-widget" strategy="lazyOnload">
          {`
            window.chatwootSettings = {"position":"right","type":"standard","launcherTitle":""};
            (function(d,t) {
              var BASE_URL="https://app.chatwoot.com";
              var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
              g.src=BASE_URL+"/packs/js/sdk.js";
              g.async=true;
              s.parentNode.insertBefore(g,s);
              g.onload=function(){
                window.chatwootSDK.run({
                  websiteToken: 'jUVvgHAbFYgME4xaUZmTSZt1',
                  baseUrl: BASE_URL
                })
              }
            })(document,"script");
          `}
        </Script>
      </body>
    </html>
  );
}
