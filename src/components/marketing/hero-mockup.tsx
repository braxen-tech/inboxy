"use client";

import { motion } from "framer-motion";
import { BookOpen, Calendar, GraduationCap, MoveRight, Sparkles, Zap } from "lucide-react";
import { EASE } from "@/lib/utils";

const products = [
  { icon: GraduationCap, title: "Curso: Treino em Casa", price: "R$ 197" },
  { icon: Calendar, title: "Mentoria individual", price: "R$ 149" },
  { icon: BookOpen, title: "E-book: Guia de Nutrição", price: "R$ 39" },
] as const;

export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
      <div aria-hidden className="absolute inset-x-8 top-10 -z-10 h-[85%] rounded-[3rem] bg-white/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 28, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative rounded-[2rem] border bg-card p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
            M
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">Mariana Costa</p>
            <p className="truncate text-xs text-muted-foreground">inboxy.store/marianacosta</p>
          </div>
          <span className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-4 text-blue-600" />
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {products.map(({ icon: Icon, title, price }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-blue-500/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Icon className="size-5 text-blue-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">Acesso imediato</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{price}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          tabIndex={-1}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white"
        >
          Ver loja completa <MoveRight className="size-4" />
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: [0, -8, 0] }}
        transition={{ opacity: { duration: 0.6, delay: 0.5 }, y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 } }}
        className="absolute -top-6 -left-4 hidden items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-lg sm:flex lg:-left-8"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15">
          <Calendar className="size-4 text-amber-600" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold">Mentoria agendada</p>
          <p className="text-[11px] text-muted-foreground">Amanhã, 14h</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{ opacity: { duration: 0.6, delay: 0.7 }, y: { duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.7 } }}
        className="absolute -right-2 -bottom-6 flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-lg sm:-right-6"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
          <Zap className="size-4 text-emerald-600" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold">Pagamento recebido</p>
          <p className="text-[11px] text-muted-foreground">+R$ 197,00</p>
        </div>
      </motion.div>
    </div>
  );
}
