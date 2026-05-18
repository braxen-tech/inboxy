import Link from "next/link";
import {
  BookOpen,
  Bot,
  MessageCircle,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: BookOpen,
    title: "Base de conhecimento",
    description:
      "Centralize FAQs, políticas, catálogo e tom de voz. O agente responde com o contexto do seu negócio, não com respostas genéricas.",
  },
  {
    icon: Bot,
    title: "Agente configurável",
    description:
      "Defina personalidade, instruções e modelo de IA. Ajuste o comportamento até combinar com a experiência que você quer oferecer.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Cloud API",
    description:
      "Conecte seu número oficial via Meta. Mensagens entram por webhook e o agente responde no mesmo canal que seus clientes já usam.",
  },
  {
    icon: Zap,
    title: "Respostas em tempo real",
    description:
      "Atendimento automático 24/7 para dúvidas recorrentes, triagem e follow-up — sem fila de espera no horário de pico.",
  },
  {
    icon: Shield,
    title: "Multi-organização",
    description:
      "Cada empresa com seu espaço isolado: credenciais, prompt e base de conhecimento separados por organização.",
  },
  {
    icon: Sparkles,
    title: "Powered by Claude",
    description:
      "Respostas naturais e contextualizadas com modelos Anthropic, integrados ao fluxo de mensagens do WhatsApp.",
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
    title: "Conecte o WhatsApp",
    description: "Integre WABA, número e token na Meta — e comece a atender.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E]">
              <MessageCircle className="size-4" aria-hidden />
            </span>
            WhatsApp Agent
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="#recursos"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Recursos
            </Link>
            <Link
              href="#como-funciona"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Como funciona
            </Link>
            <Link href="/login">
              <Button size="sm">Entrar</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.85_0.12_145/0.35),transparent)]"
            aria-hidden
          />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="secondary"
                className="mb-6 border border-[#25D366]/20 bg-[#25D366]/10 text-[#128C7E]"
              >
                Atendimento com IA no WhatsApp
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Seu agente de IA no WhatsApp,{" "}
                <span className="text-[#128C7E]">treinado no seu negócio</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-pretty sm:text-xl">
                Configure conhecimento, personalize o agente e conecte o WhatsApp Cloud API.
                Respostas automáticas, consistentes e alinhadas à sua marca — direto no app
                que seus clientes já usam.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login">
                  <Button size="lg" className="min-w-[180px] bg-[#128C7E] text-white hover:bg-[#0f7a6d]">
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

            <div className="mx-auto mt-16 max-w-2xl rounded-2xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
                  <Bot className="size-5 text-[#128C7E]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-muted-foreground">
                    Olá! Vocês entregam na minha região?
                  </div>
                  <div className="rounded-2xl rounded-tr-sm bg-[#128C7E]/10 px-4 py-2.5 text-foreground">
                    Sim! Entregamos em toda a capital e região metropolitana. O prazo médio é de
                    1 a 2 dias úteis. Quer que eu confira o CEP para você?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-b py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Tudo que você precisa para automatizar o atendimento
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Um painel simples para quem quer escalar suporte e vendas no WhatsApp sem perder
                o controle da experiência.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="border-border/80 transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-[#128C7E]" aria-hidden />
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

        <section id="como-funciona" className="bg-muted/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Do cadastro ao primeiro atendimento em 4 passos
              </h2>
              <p className="mt-4 text-muted-foreground">
                Sem código no dia a dia — configure pelo painel e deixe o agente trabalhar.
              </p>
            </div>
            <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ step, title, description }) => (
                <li key={step} className="relative">
                  <span className="text-5xl font-semibold text-[#25D366]/25">{step}</span>
                  <h3 className="mt-2 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl border bg-[#128C7E] px-6 py-14 text-center text-white sm:px-12 sm:py-16">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(1_0_0/0.15),transparent_50%)]"
                aria-hidden
              />
              <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
                Pronto para atender melhor no WhatsApp?
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-white/85 text-pretty">
                Entre no painel, configure sua base e conecte o número. Seu time ganha tempo;
                seus clientes ganham respostas na hora.
              </p>
              <Link href="/login" className="relative mt-8 inline-block">
                <Button size="lg" className="min-w-[200px] bg-white text-[#128C7E] hover:bg-white/90">
                  Acessar o painel
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} WhatsApp Agent</p>
          <p className="text-center sm:text-right">
            Integração oficial via{" "}
            <span className="text-foreground">WhatsApp Cloud API</span> · IA com Claude
          </p>
        </div>
      </footer>
    </div>
  );
}
