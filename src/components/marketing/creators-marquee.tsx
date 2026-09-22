"use client";

import { motion } from "framer-motion";

type Creator = {
  name: string;
  role: string;
  emoji: string;
  color: string;
};

const creators: Creator[] = [
  { name: "Ana Carvalho", role: "Criadora de conteúdo", emoji: "📚", color: "bg-blue-600" },
  { name: "Rafael Mendes", role: "Coach de carreira", emoji: "🎯", color: "bg-emerald-600" },
  { name: "Juliana Ferreira", role: "Educadora online", emoji: "✏️", color: "bg-violet-600" },
  { name: "Carlos Lima", role: "Designer e criador", emoji: "🎨", color: "bg-amber-600" },
  { name: "Mariana Costa", role: "Personal trainer", emoji: "💪", color: "bg-rose-600" },
  { name: "Pedro Alves", role: "Consultor de negócios", emoji: "📈", color: "bg-cyan-600" },
  { name: "Beatriz Souza", role: "Terapeuta e bem-estar", emoji: "🧘", color: "bg-teal-600" },
  { name: "Lucas Martins", role: "Produtor de conteúdo", emoji: "🎥", color: "bg-indigo-600" },
];

export function CreatorsMarquee() {
  return (
    <div className="flex gap-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <motion.div
        animate={{ translateX: "-50%" }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        className="flex w-max shrink-0 items-center gap-4"
      >
        {[...Array(2)].map((_, dup) => (
          <div key={dup} className="flex shrink-0 items-center gap-4">
            {creators.map(({ name, role, emoji, color }, i) => (
              <div
                key={`${dup}-${i}`}
                className="flex shrink-0 items-center gap-3 rounded-full border bg-card py-2 pr-5 pl-2 shadow-sm"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${color}`}
                >
                  {name.charAt(0)}
                </span>
                <div className="leading-tight whitespace-nowrap">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {emoji} {role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
