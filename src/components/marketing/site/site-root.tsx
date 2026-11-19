"use client";

import { useRef } from "react";
import { useSiteMotion } from "./site-motion";
import "./inboxy-site.css";

/** Root of the marketing pages: scopes the Inboxy design-system styles and runs the scroll motion. */
export function SiteRoot({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useSiteMotion(ref);
  return (
    <div ref={ref} className="ibx-site">
      {children}
    </div>
  );
}
