import Link from "next/link";
import {
  BookOpen,
  Bot,
  Calendar,
  CreditCard,
  Globe,
  Mail,
  MessageCircle,
  Send,
  Shield,
  Smartphone,
  Zap,
} from "lucide-react";
import { BraxenContactCta } from "@/components/marketing/braxen-contact-cta";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { buildBraxenWhatsAppUrl } from "@/lib/braxen-contact";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const channels = [
  { icon: MessageCircle, name: "WhatsApp", copy: "Onde seus clientes já estão" },
  { icon: Send, name: "Telegram", copy: "DMs com resposta automática" },
  { icon: Smartphone, name: "SMS", copy: "Confirmações e lembretes por texto" },
  { icon: Mail, name: "E-mail", copy: "Tickets e respostas assíncronas" },
  {
    icon: Globe,
    name: "Chat no site",
    copy: "Widget no seu site — um script, um balão ao vivo",
  },
] as const;

const features = [
  {
    icon: MessageCircle,
    title: "Inbox unificado",
    description:
      "WhatsApp, Telegram, SMS, e-mail e chat no site em uma única fila. Mensagens do widget do seu site entram no mesmo inbox.",
  },
  {
    icon: CreditCard,
    title: "Vendas com Stripe",
    description:
      "Catálogo, carrinho e checkout na conversa. O agente vende e envia o link de pagamento na hora.",
  },
  {
    icon: Calendar,
    title: "Agendamento com Cal.com",
    description:
      "Consulta horários e marca compromissos direto no chat, sem redirecionar para outro site.",
  },
  {
    icon: BookOpen,
    title: "Base de conhecimento",
    description:
      "Centralize FAQs, políticas e tom de voz. O agente responde com o contexto do seu negócio.",
  },
  {
    icon: Bot,
    title: "Agente configurável",
    description:
      "Defina personalidade, instruções e modelo de IA. Ajuste até combinar com a experiência da sua marca.",
  },
  {
    icon: Shield,
    title: "Multi-organização",
    description:
      "Cada empresa com espaço isolado: credenciais, prompt e base de conhecimento separados.",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Crie sua conta",
    description: "Acesse o painel e vincule sua organização em poucos minutos.",
  },
  {
    step: "02",
    title: "Monte a base",
    description: "Cadastre o que o agente precisa saber sobre produtos, preços e processos.",
  },
  {
    step: "03",
    title: "Configure o agente",
    description: "Ajuste o prompt, o modelo e o estilo de atendimento da sua marca.",
  },
  {
    step: "04",
    title: "Conecte os canais",
    description:
      "Conecte WhatsApp Business e Instagram DM em minutos via Meta Embedded Signup — sem sair do Inboxy.",
  },
  {
    step: "05",
    title: "Ative vendas e agendamento",
    description: "Conecte Stripe e Cal.com para vender e agendar direto na conversa.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.85_0.12_250/0.35),transparent)]"
            aria-hidden
          />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="secondary"
                className="mb-6 border border-blue-500/20 bg-blue-500/10 text-blue-600"
              >
                WhatsApp · Telegram · SMS · E-mail · Chat no site · Vendas · Agendamento
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Todos os seus canais.{" "}
                <span className="text-blue-600">Um só lugar para atender, vender e agendar.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-pretty sm:text-xl">
                Conecte WhatsApp Business e Instagram DM via Meta Embedded Signup em minutos.
                O agente responde, vende com Stripe e agenda com Cal.com na mesma conversa.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login">
                  <Button size="lg" className="min-w-[180px] bg-blue-600 text-white hover:bg-blue-700">
                    Começar agora
                  </Button>
                </Link>
                <Link href="#como-funciona">
                  <Button variant="outline" size="lg" className="min-w-[180px]">
                    Ver como funciona
                  </Button>
                </Link>
              </div>
            </div>

            {/* Chat mock */}
            <div className="mx-auto mt-16 max-w-2xl rounded-2xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5 sm:p-6">
              <p className="mb-3 text-center text-xs font-medium text-muted-foreground">
                Do primeiro contato ao pagamento, sem sair da conversa
              </p>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                  <Bot className="size-5 text-blue-600" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-muted-foreground">
                    Quero comprar o Vinho Malbec. Tem disponível?
                  </div>
                  <div className="rounded-2xl rounded-tr-sm bg-blue-600/10 px-4 py-2.5 text-foreground">
                    Sim! Vinho Malbec — R$ 299,00. Adicionei ao carrinho.
                    Aqui está seu link seguro para finalizar a compra: checkout.stripe.com/...
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-muted-foreground">
                    E tem horário pra degustação na quinta?
                  </div>
                  <div className="rounded-2xl rounded-tr-sm bg-blue-600/10 px-4 py-2.5 text-foreground">
                    Quinta temos 14h e 16h disponíveis. Qual prefere? Já agendo pra você!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Canais */}
        <section id="canais" className="border-b py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Seus clientes falam por vários canais. Atenda em todos.
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Uma inbox unificada para WhatsApp Business e Instagram DM. Conecte via Meta
                Embedded Signup e o agente responde em ambos os canais com o mesmo contexto,
                base de conhecimento e regras.
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {channels.map(({ icon: Icon, name, copy }) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center transition-shadow hover:shadow-md"
                >
                  <div className="flex size-12 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="size-6 text-blue-600" aria-hidden />
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">{copy}</span>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-center text-sm text-muted-foreground">
              <p className="text-pretty">
                <span className="font-medium text-foreground">Onboarding em minutos:</span> o
                Meta Embedded Signup v4 conecta WhatsApp Business e Instagram DM no mesmo fluxo,
                sem token manual nem configuração no Facebook Business Manager.
              </p>
            </div>
          </div>
        </section>

        {/* Integrações: Stripe + Cal.com */}
        <section id="integracoes" className="bg-muted/40 border-b py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Venda e agende direto na conversa
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Integração nativa com Stripe e Cal.com. Sem tirar o cliente do chat.
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-4xl gap-8 lg:grid-cols-2">
              {/* Stripe */}
              <div className="rounded-2xl border bg-card p-6 sm:p-8">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-500/10">
                  <CreditCard className="size-6 text-blue-600" aria-hidden />
                </div>
                <h3 className="text-xl font-semibold">Venda no chat com Stripe</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Produtos e preços vêm do catálogo Stripe — sem duplicar cadastro
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Agente monta carrinho e gera link de pagamento na hora
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Confirmação automática após pagamento — cliente recebe no mesmo canal
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Credenciais criptografadas no painel
                  </li>
                </ul>
              </div>

              {/* Cal.com */}
              <div className="rounded-2xl border bg-card p-6 sm:p-8">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-500/10">
                  <Calendar className="size-6 text-blue-600" aria-hidden />
                </div>
                <h3 className="text-xl font-semibold">Agende no chat com Cal.com</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Conecte Cal.com no painel de integrações
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Agente consulta horários disponíveis em tempo real
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Cliente confirma e recebe o agendamento na conversa
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                    Sem redirecionar para outro site ou app
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="border-b py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Tudo para automatizar atendimento, vendas e agendamento
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Um painel simples para escalar suporte e vendas em qualquer canal sem
                perder o controle da experiência.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="border-border/80 transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-blue-600" aria-hidden />
                    </div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-base leading-relaxed">
                      {description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="bg-muted/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Do cadastro ao primeiro atendimento em 5 passos
              </h2>
              <p className="mt-4 text-muted-foreground">
                Sem código no dia a dia — configure pelo painel e deixe o agente trabalhar.
              </p>
            </div>
            <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map(({ step, title, description }) => (
                <li key={step} className="relative">
                  <span className="text-5xl font-semibold text-blue-500/25">{step}</span>
                  <h3 className="mt-2 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl border bg-blue-600 px-6 py-14 text-center text-white sm:px-12 sm:py-16">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(1_0_0/0.15),transparent_50%)]"
                aria-hidden
              />
              <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
                Atenda, venda e agende em todos os canais
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-white/85 text-pretty">
                WhatsApp, Telegram, e-mail ou visitante no site — tudo na mesma fila.
                Configure o agente, conecte Stripe e Cal.com — respostas na hora em qualquer canal.
              </p>
              <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login">
                  <Button size="lg" className="min-w-[200px] bg-white text-blue-600 hover:bg-white/90">
                    Acessar o painel
                  </Button>
                </Link>
                <a
                  href={buildBraxenWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "min-w-[200px] border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white",
                  )}
                >
                  Falar com a Braxen
                </a>
              </div>
            </div>
          </div>
        </section>

        <BraxenContactCta />
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} Inboxy</p>
          <p className="text-center sm:text-right">
            Integração via{" "}
            <span className="text-foreground">Meta</span> ·{" "}
            <span className="text-foreground">Stripe</span> ·{" "}
            <span className="text-foreground">Cal.com</span> · IA com Claude
          </p>
        </div>
      </footer>
    </div>
  );
}
