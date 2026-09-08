import Link from "next/link";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  Link2,
  MoveRight,
  Package,
  ShoppingBag,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { BraxenContactCta } from "@/components/marketing/braxen-contact-cta";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel, SectionTitle } from "@/components/ui/motion-primitives";
import { TestimonialsColumn, type TestimonialItem } from "@/components/ui/testimonials-columns";

const features = [
  {
    icon: Link2,
    title: "Loja com link próprio",
    description: "Uma vitrine com seu nome, seu visual e seu link. Compartilhe onde quiser.",
  },
  {
    icon: Video,
    title: "Cursos online com vídeo",
    description: "Crie módulos e aulas. Seus alunos acompanham o progresso no portal deles.",
  },
  {
    icon: Package,
    title: "Entrega automática",
    description: "E-books, templates e planilhas entregues por e-mail logo após o pagamento.",
  },
  {
    icon: Calendar,
    title: "Agendamento de mentorias",
    description: "Sessões individuais com link de pagamento e agenda integrada.",
  },
  {
    icon: Users,
    title: "Portal do aluno",
    description: "Seus alunos acessam os cursos em um portal dedicado, sem precisar de app.",
  },
  {
    icon: Zap,
    title: "Pagamentos integrados",
    description: "Checkout simples, recebimento direto. Sem criar conta em outra plataforma.",
  },
] as const;

const steps = [
  { step: "01", title: "Crie sua conta grátis", description: "Cadastre-se e monte sua organização em minutos. Sem cartão de crédito." },
  { step: "02", title: "Adicione seus produtos", description: "Cursos, e-books, templates ou mentorias — tudo em um só painel." },
  { step: "03", title: "Compartilhe seu link", description: "Sua loja tem um link único. Cole no Instagram, WhatsApp ou onde preferir." },
  { step: "04", title: "Receba, entregue e cresça", description: "Pagamentos, entregas e acessos acontecem de forma automática." },
] as const;

const testimonials: TestimonialItem[] = [
  { text: "Publiquei meu e-book e vendi nas primeiras horas — sem precisar de site, sem nada.", name: "Ana Carvalho", role: "Criadora de conteúdo" },
  { text: "Coloquei meu curso no ar em uma tarde. O portal do aluno já veio pronto.", name: "Rafael Mendes", role: "Coach de carreira" },
  { text: "Meus clientes chegam pelo link, compram e recebem o acesso sozinhos. É automático.", name: "Juliana Ferreira", role: "Educadora online" },
  { text: "Finalmente um lugar só para os meus produtos. Antes eu mandava PDF por WhatsApp.", name: "Carlos Lima", role: "Designer e criador" },
  { text: "Em um mês já tinha mais de 30 alunos. E eu não precisei me preocupar com nada técnico.", name: "Mariana Costa", role: "Personal trainer" },
  { text: "Vendi minha primeira mentoria no mesmo dia que criei a loja.", name: "Pedro Alves", role: "Consultor de negócios" },
];

const firstCol = testimonials.slice(0, 3);
const secondCol = testimonials.slice(3);

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="w-full py-20 lg:py-36">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
              {/* Left column */}
              <div className="flex flex-col gap-6">
                <div>
                  <Badge variant="outline">Inboxy Creators</Badge>
                </div>
                <div className="flex flex-col gap-4">
                  <h1 className="max-w-lg text-5xl font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl">
                    Sua loja online para cursos, e-books e mentorias.
                  </h1>
                  <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                    Crie sua vitrine em minutos, compartilhe seu link e comece a receber.
                    Tudo em um só lugar, sem complicação.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/login">
                    <Button size="lg" className="gap-3">
                      Criar minha loja grátis <MoveRight className="size-4" />
                    </Button>
                  </Link>
                  <Link href="#como-funciona">
                    <Button size="lg" variant="outline">
                      Ver como funciona
                    </Button>
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">Grátis para começar. Sem cartão de crédito.</p>
              </div>

              {/* Right column — image grid */}
              <div className="hidden grid-cols-2 gap-6 md:grid">
                <img
                  src="https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500&q=80"
                  alt="Criadora de conteúdo"
                  className="aspect-square w-full rounded-2xl object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&q=80"
                  alt="Loja digital"
                  className="row-span-2 w-full rounded-2xl object-cover"
                />
                <img
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&q=80"
                  alt="Cursos online"
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* O que você pode vender */}
        <section id="produtos" className="border-y bg-muted/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>O que você pode vender</SectionLabel>
              <SectionTitle className="text-foreground">
                Uma plataforma, tudo o que você cria
              </SectionTitle>
            </div>
            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-8">
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <GraduationCap className="size-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold">Cursos online</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Crie módulos e aulas em vídeo. Seus alunos acompanham o progresso no portal deles, no próprio ritmo.
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-8">
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <BookOpen className="size-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold">Produtos digitais</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  E-books, templates, planilhas. O comprador recebe na hora, direto no e-mail — sem você precisar fazer nada.
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-8">
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <Users className="size-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold">Mentorias</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Sessões individuais com agendamento simples e recebimento integrado. Você foca no conteúdo, o resto é automático.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="border-b py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>Recursos</SectionLabel>
              <SectionTitle className="text-foreground">
                Tudo o que você precisa para vender
              </SectionTitle>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex flex-col gap-3 rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="bg-muted/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>Como funciona</SectionLabel>
              <SectionTitle className="text-foreground">
                Do cadastro à primeira venda em minutos
              </SectionTitle>
            </div>
            <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ step, title, description }) => (
                <li key={step}>
                  <span className="text-5xl font-bold text-blue-500/20">{step}</span>
                  <h3 className="mt-3 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Testimonials */}
        <section id="loja" className="border-y py-20 sm:py-24 overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <SectionLabel>Depoimentos</SectionLabel>
              <SectionTitle className="text-foreground">
                O que dizem os criadores
              </SectionTitle>
            </div>
            <div className="flex max-h-[560px] gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
              <TestimonialsColumn
                testimonials={firstCol}
                duration={14}
                className="flex-1"
              />
              <TestimonialsColumn
                testimonials={secondCol}
                duration={18}
                className="flex-1 hidden sm:block"
              />
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl border bg-blue-600 px-6 py-14 text-center text-white sm:px-12 sm:py-16">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(1_0_0/0.15),transparent_50%)]"
                aria-hidden
              />
              <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
                Pronto para monetizar o que você sabe?
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-white/85 text-pretty">
                Crie sua loja, adicione seus produtos e compartilhe com sua audiência. Grátis para começar.
              </p>
              <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login">
                  <Button size="lg" className="min-w-[220px] bg-white text-blue-600 hover:bg-white/90">
                    Criar minha loja grátis
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <BraxenContactCta />
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} Inboxy</p>
          <p className="text-center text-xs sm:text-right">
            Feito para criadores de conteúdo, educadores e profissionais independentes.
          </p>
        </div>
      </footer>
    </div>
  );
}
