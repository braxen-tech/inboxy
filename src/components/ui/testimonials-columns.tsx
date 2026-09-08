"use client";

import React from "react";
import { motion } from "framer-motion";

export type TestimonialItem = {
  text: string;
  name: string;
  role: string;
};

export function TestimonialsColumn(props: {
  className?: string;
  testimonials: TestimonialItem[];
  duration?: number;
}) {
  return (
    <div className={props.className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration ?? 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 bg-background pb-6"
      >
        {[...new Array(2).fill(0)].map((_, index) => (
          <React.Fragment key={index}>
            {props.testimonials.map(({ text, name, role }, i) => (
              <article
                key={`${index}-${i}`}
                className="w-full rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{text}&rdquo;
                </p>
                <div className="mt-5 border-t border-border pt-4">
                  <span className="block text-sm font-semibold leading-tight">
                    {name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">
                    {role}
                  </span>
                </div>
              </article>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}
