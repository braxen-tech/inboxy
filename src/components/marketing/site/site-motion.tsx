"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/**
 * Scroll-driven motion for the marketing pages (reference: dialedcoffee.com).
 * Every block is optional: it only runs when its elements exist on the page.
 */
export function useSiteMotion(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
    const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => Array.from(r.querySelectorAll<T>(s));
    const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
    const setCounters = () =>
      $$("[data-count]").forEach((el) => {
        el.textContent = (el.dataset.prefix ?? "") + fmt(Number(el.dataset.count)) + (el.dataset.suffix ?? "");
      });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root.classList.add("rm");
      setCounters();
      $(".loader")?.remove();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // split text into characters, keeping inner elements (e.g. .hl)
    const splitChars = (el: Element) => {
      const walk = (node: Node) => {
        Array.from(node.childNodes).forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            for (const c of n.textContent ?? "") {
              const s = document.createElement("span");
              s.className = "ch";
              s.textContent = c === " " ? " " : c;
              frag.appendChild(s);
            }
            n.parentNode?.replaceChild(frag, n);
          } else if (n.nodeType === Node.ELEMENT_NODE) walk(n);
        });
      };
      walk(el);
    };
    $$(".split").forEach((el) => {
      if (!el.dataset.split) {
        splitChars(el);
        el.dataset.split = "1";
      }
    });

    const lenis = new Lenis({ lerp: 0.085 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    lenis.stop();

    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href") ?? "";
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      lenis.scrollTo(t as HTMLElement, { duration: 1.4 });
    };
    root.addEventListener("click", onAnchor);

    const isMobile = () => window.innerWidth < 900;
    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      /* ---------- Preloader + intro ---------- */
      const heroChars = $$(".hero__words .ch");
      const peek = () => Math.min(window.innerHeight * 0.34, 300);
      gsap.set(heroChars, { yPercent: 115 });
      gsap.set("#heroPhone .phone", { y: 0, rotate: -14 });
      gsap.set(".hero .float", { opacity: 0, scale: 0.6 });
      gsap.set(".nav", { yPercent: -160 });

      const counter = { v: 0 };
      const countEl = $("#count");
      gsap
        .timeline({ delay: 0.1 })
        .to(counter, { v: 100, duration: 1.2, ease: "power2.inOut", onUpdate: () => { if (countEl) countEl.textContent = String(Math.round(counter.v)); } })
        .to(".loader__name", { yPercent: -60, opacity: 0, duration: 0.45, ease: "power3.in" }, "-=.2")
        .to(".loader", { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut" }, "-=.15")
        .to(heroChars, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.035 }, "-=.5")
        .to("#heroPhone .phone", { y: () => -peek(), rotate: -10, duration: 1.4, ease: "expo.out" }, "-=.9")
        .to(".hero .float", { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)", stagger: 0.07 }, "-=1.1")
        .to(".nav", { yPercent: 0, duration: 0.8, ease: "expo.out" }, "-=.9")
        .add(() => {
          $(".loader")?.remove();
          lenis.start();
          ScrollTrigger.refresh();
        });

      /* ---------- Hero: pinned stage ---------- */
      if ($("#hero")) {
        const phoneTarget = () => {
          const H = window.innerHeight;
          const cy = isMobile() ? H * 0.3 : H * 0.47;
          return cy - (H + 325) + peek();
        };
        const hero = gsap.timeline({
          scrollTrigger: { trigger: "#hero", start: "top top", end: "+=190%", pin: true, scrub: 1, invalidateOnRefresh: true },
        });
        hero
          .to("#heroPhone", { y: phoneTarget, rotate: 10, scale: () => (isMobile() ? 0.62 : 1), duration: 1, ease: "power2.inOut" }, 0)
          .to(".hero__words .w1", { xPercent: -18, duration: 1.8, ease: "none" }, 0)
          .to(".hero__words .w2", { xPercent: 18, duration: 1.8, ease: "none" }, 0)
          .to(".hero__words .w3", { xPercent: -10, duration: 1.8, ease: "none" }, 0)
          .to(".hero__meta, .hero__scroll", { opacity: 0, y: -20, duration: 0.3 }, 0)
          .fromTo("#heroPanel", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "power2.inOut" }, 0.55)
          .to("#heroPhone", { x: () => (isMobile() ? 0 : window.innerWidth * 0.2), rotate: 17, scale: () => (isMobile() ? 0.55 : 0.86), duration: 0.7, ease: "power2.inOut" }, 1.05)
          .to("#heroPhone", { autoAlpha: () => (isMobile() ? 0 : 1), y: () => (isMobile() ? phoneTarget() - window.innerHeight * 0.4 : phoneTarget()), duration: 0.5 }, 1.25)
          .fromTo("#heroCopy", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 1.3)
          .fromTo("#heroRight", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 1.4)
          .to({}, { duration: 0.3 });
        $$(".hero .float").forEach((f) => {
          const sp = parseFloat(f.dataset.speed ?? "1");
          hero.to(f, { y: () => -window.innerHeight * 0.55 * sp, rotate: (sp - 1.4) * 14, ease: "none", duration: 2.1 }, 0);
        });
        // chat messages pop in while the phone rises (business hero)
        const msgs = $$("#heroPhone [data-msg]");
        if (msgs.length) {
          gsap.set(msgs, { autoAlpha: 0, y: 16, scale: 0.92 });
          msgs.forEach((m, i) => {
            hero.to(m, { autoAlpha: 1, y: 0, scale: 1, duration: 0.12, ease: "back.out(2)" }, 0.1 + i * 0.16);
          });
        }
      }

      /* ---------- Statement: words light up ---------- */
      const man = $("#manifesto");
      if (man) {
        if (!man.dataset.split) {
          Array.from(man.childNodes).forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) {
              const frag = document.createDocumentFragment();
              (n.textContent ?? "").split(/(\s+)/).forEach((w) => {
                if (!w) return;
                if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
                const s = document.createElement("span");
                s.className = "w";
                s.textContent = w;
                frag.appendChild(s);
              });
              n.parentNode?.replaceChild(frag, n);
            } else if (n.nodeType === Node.ELEMENT_NODE) (n as Element).classList.add("w");
          });
          man.dataset.split = "1";
        }
        gsap.to($$(".w", man), { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: man, start: "top 80%", end: "bottom 45%", scrub: true } });
      }

      /* ---------- Horizontal cards ---------- */
      const track = $("#htrack");
      if (track) {
        const hTween = gsap.to(track, {
          x: () => -(track.scrollWidth - window.innerWidth),
          ease: "none",
          scrollTrigger: { trigger: "#hpin", start: "top top", end: () => "+=" + (track.scrollWidth - window.innerWidth), pin: true, scrub: 1, invalidateOnRefresh: true },
        });
        $$(".hcard").forEach((c, i) => {
          gsap.from(c, { yPercent: 18, rotate: i % 2 ? 4 : -4, ease: "none", scrollTrigger: { trigger: c, containerAnimation: hTween, start: "left 100%", end: "left 55%", scrub: true } });
          const shape = c.querySelector(".shape");
          if (shape) gsap.from(shape, { scale: 0.2, ease: "none", scrollTrigger: { trigger: c, containerAnimation: hTween, start: "left 90%", end: "left 35%", scrub: true } });
        });
        gsap.from(".hscroll__head h2", { yPercent: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".hscroll", start: "top 70%" } });
      }

      /* ---------- Sticky dashboard ---------- */
      if ($("#bizDash")) {
        gsap.from(".biz__head h2", { yPercent: 30, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: ".biz", start: "top 70%" } });
        gsap.from("#bizDash", { y: 120, rotate: -6, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".biz__grid", start: "top 75%" } });
        gsap.from("#dChart .bars span", { scaleY: 0, stagger: 0.06, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".biz__grid", start: "top 60%" } });
        ScrollTrigger.create({
          trigger: ".biz__grid", start: "top 60%", once: true,
          onEnter: () => {
            $$("#bizDash [data-count]").forEach((el) => {
              const o = { v: 0 };
              gsap.to(o, { v: Number(el.dataset.count), duration: 2, ease: "power3.out", onUpdate: () => { el.textContent = (el.dataset.prefix ?? "") + fmt(o.v) + (el.dataset.suffix ?? ""); } });
            });
          },
        });
        $$(".feat").forEach((f) => {
          ScrollTrigger.create({
            trigger: f, start: "top 55%", end: "bottom 55%", toggleClass: "on",
            onToggle: (s) => {
              if (!s.isActive) return;
              $$(".hl-ring").forEach((x) => x.classList.remove("hl-ring"));
              if (f.dataset.hl) root.querySelector("#" + f.dataset.hl)?.classList.add("hl-ring");
            },
          });
        });
      }

      /* ---------- Giant word: letters jump in ---------- */
      const letters = $$(".allin__word .ch");
      if (letters.length) {
        gsap.from(letters, { yPercent: 110, rotate: (i) => (i % 2 ? 12 : -12), stagger: 0.05, ease: "back.out(1.6)", scrollTrigger: { trigger: ".allin__word", start: "top 92%", end: "top 35%", scrub: 1 } });
      }
      if ($("#tools")) gsap.from("#tools > *", { y: 30, opacity: 0, stagger: 0.06, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: "#tools", start: "top 80%" } });
      if ($("#oldPrice")) gsap.to("#oldPrice", { "--strike": 1, ease: "none", scrollTrigger: { trigger: "#price", start: "top 75%", end: "top 35%", scrub: true } });
      const npEl = $("#newPrice");
      if (npEl) {
        const np = { v: 930 };
        gsap.to(np, { v: 97, ease: "none", onUpdate: () => { npEl.textContent = String(Math.round(np.v)); }, scrollTrigger: { trigger: "#price", start: "top 70%", end: "top 30%", scrub: true } });
      }

      /* ---------- Steps: stacking cards ---------- */
      const steps = $$(".step");
      steps.forEach((s, i) => {
        const next = steps[i + 1];
        if (!next) return;
        gsap.fromTo(s, { scale: 1, filter: "brightness(1)" }, { scale: 0.92, filter: "brightness(0.93)", ease: "none", scrollTrigger: { trigger: next, start: "top bottom", end: "top 120px", scrub: true } });
      });
      if ($(".steps")) gsap.from(".steps__head h2", { yPercent: 30, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".steps", start: "top 70%" } });

      /* ---------- Bridge card ---------- */
      if ($(".bridge")) gsap.from(".bridge__card", { y: 80, rotate: -2, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: ".bridge", start: "top 80%" } });

      /* ---------- Marquees driven by scroll velocity ---------- */
      const loops = $$(".marquee").map((row, i) =>
        gsap.fromTo(row, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration: 38, ease: "none", repeat: -1 }),
      );
      if (loops.length) {
        let dir = 1;
        lenis.on("scroll", (e: Lenis) => {
          if (e.direction) dir = e.direction;
          const boost = 1 + Math.min(Math.abs(e.velocity) / 6, 5);
          loops.forEach((tl) => gsap.to(tl, { timeScale: dir * boost, duration: 0.3, overwrite: true }));
        });
        gsap.from(".quotes__head h2", { yPercent: 30, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".quotes", start: "top 70%" } });
      }

      /* ---------- Footer ---------- */
      gsap.from(".cta h2", { yPercent: 25, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: ".cta", start: "top 70%" } });
      gsap.fromTo("#mega", { yPercent: 70 }, { yPercent: 12, ease: "none", scrollTrigger: { trigger: "#mega", start: "top bottom", end: "bottom bottom", scrub: true } });
    }, root);

    /* ---------- Nav hide/show ---------- */
    let lastY = 0;
    lenis.on("scroll", ({ scroll }: Lenis) => {
      const nav = $("#nav");
      if (!nav) return;
      if (scroll > 200 && scroll > lastY + 4) nav.classList.add("is-hidden");
      else if (scroll < lastY - 4 || scroll < 200) nav.classList.remove("is-hidden");
      lastY = scroll;
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh);
    cleanups.push(() => window.removeEventListener("load", refresh));

    return () => {
      cleanups.forEach((c) => c());
      root.removeEventListener("click", onAnchor);
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [rootRef]);
}
