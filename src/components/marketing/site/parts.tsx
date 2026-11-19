import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* ---------- Icons (Lucide-style strokes) ---------- */
const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const IconCheck = () => (<svg {...svgProps}><path d="M20 6 9 17l-5-5" /></svg>);
export const IconCalendar = () => (<svg {...svgProps}><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>);
export const IconLink = () => (<svg {...svgProps}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>);

/* ---------- Brand ---------- */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <b style={{ width: size, height: size }} aria-hidden>
      i
    </b>
  );
}

/* ---------- Loader ---------- */
export function Loader() {
  return (
    <div className="loader" aria-hidden="true">
      <div className="loader__name">Inboxy</div>
      <div className="loader__bubbles"><i /><i /><i /></div>
      <div className="loader__count"><span id="count">0</span>%</div>
    </div>
  );
}

/* ---------- Nav ---------- */
export function Nav({ links, cta, switchLink }: { links: { href: string; label: string }[]; cta: { href: string; label: string }; switchLink: { href: string; label: string } }) {
  return (
    <header className="nav" id="nav">
      <nav className="nav__links" aria-label="Principal">
        {links.map((l) => (
          <a key={l.href} href={l.href}>{l.label}</a>
        ))}
        <Link href={switchLink.href}>{switchLink.label}</Link>
      </nav>
      <Link className="nav__logo" href="/" aria-label="Inboxy, início"><LogoMark />Inboxy</Link>
      <div className="nav__cta">
        <Link className="login" href="/login">Entrar</Link>
        <a className="btn btn--ink" href={cta.href}>{cta.label}</a>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
export function Hero({
  words, title, meta, panelTitle, panelText, panelActions, rightBig, rightSmall, phone, floats,
}: {
  words: [string, string, string];
  title: string;
  meta: string;
  panelTitle: ReactNode;
  panelText: string;
  panelActions: ReactNode;
  rightBig: string;
  rightSmall: string;
  phone: ReactNode;
  floats: ReactNode;
}) {
  return (
    <section className="hero" id="hero" aria-label="Apresentação">
      <div className="hero__words" aria-hidden="true">
        <span className="line w1"><span className="display split">{words[0]}</span></span>
        <span className="line w2"><span className="display split">{words[1]}</span></span>
        <span className="line w3"><span className="display split"><span className="hl">{words[2]}</span></span></span>
      </div>
      <h1 className="sr">{title}</h1>
      <div className="hero__meta"><p>{meta}</p></div>
      <div className="hero__scroll label">Role <i /></div>
      <div className="hero__panel" id="heroPanel">
        <div className="hero__panel-copy" id="heroCopy">
          <h2>{panelTitle}</h2>
          <p>{panelText}</p>
          <div className="row">{panelActions}</div>
        </div>
        <div className="hero__panel-right" id="heroRight"><div className="big">{rightBig}</div><small>{rightSmall}</small></div>
      </div>
      <div className="hero__stage" aria-hidden="true">
        <div className="phone-wrap" id="heroPhone">{phone}</div>
      </div>
      {floats}
    </section>
  );
}

export function Float({ speed, style, children }: { speed: number; style: CSSProperties; children: ReactNode }) {
  return <div className="float" data-speed={speed} style={style}>{children}</div>;
}

export function Chip({ icon, tone, title, sub }: { icon: ReactNode; tone: "yellow" | "coral" | "blue" | "ink"; title: string; sub: string }) {
  return (
    <div className="chip">
      <div className={`chip__ic t-${tone}`}>{icon}</div>
      <div><b>{title}</b><small>{sub}</small></div>
    </div>
  );
}

/* ---------- Phones ---------- */
export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="phone"><div className="phone__screen"><div className="phone__notch" />{children}</div></div>
  );
}

export type Product = { t: string; tone: "blue" | "coral" | "yellow" | "ink"; name: string; meta: string; price: string };

export function StorePhone({ initial, name, url, chips, products, cta, coverTone, avatarTone }: {
  initial: string; name: string; url: string; chips: string[]; products: Product[]; cta: string; coverTone?: string; avatarTone?: string;
}) {
  return (
    <Phone>
      <div className="store__cover" style={coverTone ? { background: coverTone } : undefined} />
      <div className="store__head">
        <div className="store__avatar" style={avatarTone ? { background: avatarTone } : undefined}>{initial}</div>
        <div className="store__name">{name}</div>
        <div className="store__url">{url}</div>
        <div className="store__chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>
      </div>
      <div className="store__list">
        {products.map((p) => (
          <div className="prod" key={p.name}>
            <div className={`prod__t t-${p.tone}`}>{p.t}</div>
            <div className="prod__b"><div className="prod__n">{p.name}</div><div className="prod__m">{p.meta}</div></div>
            <div className="prod__p">{p.price}</div>
          </div>
        ))}
      </div>
      <div className="store__btn">{cta}</div>
    </Phone>
  );
}

export function ChatPhone() {
  return (
    <Phone>
      <div className="chat__head">
        <div className="chat__av">S</div>
        <div><b>Clínica Sorriso</b><small>Agente IA online</small></div>
      </div>
      <div className="chat__body">
        <div className="bub bub--in" data-msg>Oi! Vocês têm horário amanhã à tarde?<small>14:02</small></div>
        <div className="bub bub--bot" data-msg>Temos sim! 14h ou 16h. Qual fica melhor pra você?<small>Agente IA · 14:02</small></div>
        <div className="bub bub--in" data-msg>16h. Quanto custa a avaliação?<small>14:03</small></div>
        <div className="bub bub--bot" data-msg>R$ 120. Já deixei reservado — é só confirmar o pagamento:<small>Agente IA · 14:03</small></div>
        <div className="chat__pay" data-msg>
          <div className="prod__t t-yellow" style={{ width: 34, height: 34 }}>R$</div>
          <div><b>Avaliação · amanhã 16h</b><small>R$ 120,00 · PIX ou cartão</small></div>
        </div>
        <div className="bub bub--in" data-msg>Pago! ✓<small>14:05</small></div>
      </div>
      <div className="chat__input">Mensagem</div>
    </Phone>
  );
}

/* ---------- Dashboard mock ---------- */
export function Dashboard() {
  return (
    <div className="dash" id="bizDash">
      <div className="dash__side"><b>i</b><i className="on" /><i /><i /><i /><i /></div>
      <div className="dash__main">
        <div className="dash__top"><h4>Visão geral · Novembro</h4><span className="live">Bot online</span></div>
        <div className="dash__stats" id="dStats">
          <div className="st"><span>Receita</span><strong data-count="12480" data-prefix="R$ ">R$ 0</strong><em>▲ 18%</em></div>
          <div className="st"><span>Conversas</span><strong data-count="1932">0</strong><em>▲ 12%</em></div>
          <div className="st"><span>Resolvidas pelo bot</span><strong data-count="87" data-suffix="%">0%</strong><em>meta 80%</em></div>
        </div>
        <div className="dash__row">
          <div className="dash__chart" id="dChart">
            <span className="label" style={{ color: "var(--ink-muted)" }}>Vendas por semana</span>
            <div className="bars">
              {[35, 48, 42, 60, 55, 72].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
              <span className="on" style={{ height: "96%" }} />
            </div>
          </div>
          <div className="dash__inbox" id="dInbox">
            <div className="msg"><i className="t-coral">A</i><div><b>Ana · WhatsApp</b><small>Agendado para 16h ✓</small></div><u>bot</u></div>
            <div className="msg"><i className="t-yellow">J</i><div><b>João · Instagram</b><small>Link de pagamento enviado</small></div><u>bot</u></div>
            <div className="msg"><i className="t-blue">P</i><div><b>Paula · WhatsApp</b><small>Quero falar com atendente</small></div><u className="h">humano</u></div>
            <div className="msg"><i className="t-ink">L</i><div><b>Lucas · Site</b><small>Vocês atendem sábado?</small></div><u>bot</u></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sections ---------- */
export function Statement({ label, aside, asideCta, children }: { label: string; aside: string; asideCta: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="statement" aria-label="Manifesto">
      <div className="statement__side">
        <span className="label">{label}</span>
        <p>{aside}</p>
        <a className="btn btn--secondary" href={asideCta.href}>{asideCta.label} <span className="arr">→</span></a>
      </div>
      <p className="big" id="manifesto">{children}</p>
    </section>
  );
}

export type HCard = { color: string; shape: string; title: string; text: string; tag: string };
export function HorizontalCards({ id, title, lead, cards }: { id: string; title: ReactNode; lead: string; cards: HCard[] }) {
  return (
    <section className="hscroll" id={id} aria-label="Recursos">
      <div className="hscroll__pin" id="hpin">
        <div className="hscroll__head"><h2>{title}</h2><p>{lead}</p></div>
        <div className="hscroll__track" id="htrack">
          {cards.map((c, i) => (
            <article className={`hcard c-${c.color}`} key={c.title}>
              <div className="shape" style={{ background: `var(--${c.shape})` }} />
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <div><h3>{c.title}</h3><p>{c.text}</p><span className="tag">{c.tag}</span></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export type Feature = { hl: "dInbox" | "dStats" | "dChart"; num: string; title: string; text: string; tags?: string[]; cta?: { href: string; label: string } };
export function StickyDashboard({ id, label, title, features }: { id: string; label: string; title: ReactNode; features: Feature[] }) {
  return (
    <section className="biz" id={id} aria-label={label}>
      <div className="biz__head"><span className="label">{label}</span><h2>{title}</h2></div>
      <div className="biz__grid">
        <div className="biz__sticky"><Dashboard /></div>
        <div className="biz__list">
          {features.map((f) => (
            <div className="feat" data-hl={f.hl} key={f.num}>
              <span className="num">{f.num}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              {f.tags && <ul>{f.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
              {f.cta && <a className="btn btn--yellow" style={{ marginTop: 24, alignSelf: "flex-start" }} href={f.cta.href}>{f.cta.label} <span className="arr">→</span></a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GiantWord({ text }: { text: string }) {
  return (
    <div className="allin__word" aria-hidden="true">
      {Array.from(text).map((c, i) => <span className="ch" key={i}>{c === " " ? " " : c}</span>)}
    </div>
  );
}

export type Step = { k: string; title: string; text: string; meta: string; color: string };
export function Steps({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <section className="steps" aria-label="Como funciona" id="como-funciona">
      <div className="steps__head"><h2>{title}</h2><span className="label">Como funciona</span></div>
      {steps.map((s, i) => (
        <div className={`step c-${s.color}`} key={s.k}>
          <div className="k" style={i === steps.length - 1 && s.color === "ink" ? { color: "var(--yellow)" } : undefined}>{s.k}</div>
          <div><h3>{s.title}</h3><p>{s.text}</p></div>
          <span className="label who">{s.meta}</span>
        </div>
      ))}
    </section>
  );
}

export type Quote = { text: string; name: string; role: string; tone: "coral" | "ink" | "blue" | "yellow"; yellow?: boolean };
export function Quotes({ title, rows }: { title: ReactNode; rows: Quote[][] }) {
  return (
    <section className="quotes" aria-label="Depoimentos">
      <div className="quotes__head"><h2>{title}</h2><span className="label">Depoimentos</span></div>
      {rows.map((row, r) => (
        <div className="marquee" key={r}>
          {[...row, ...row].map((q, i) => (
            <figure className={`q${q.yellow ? " y" : ""}`} key={i} aria-hidden={i >= row.length ? true : undefined}>
              <p>“{q.text}”</p>
              <figcaption className="who"><i className={`t-${q.tone}`}>{q.name[0]}</i><span><b>{q.name}</b><small>{q.role}</small></span></figcaption>
            </figure>
          ))}
        </div>
      ))}
    </section>
  );
}

export function Bridge({ color, shape, label, title, text, href, cta }: { color: string; shape: string; label: string; title: ReactNode; text: string; href: string; cta: string }) {
  return (
    <section className="bridge" aria-label={label}>
      <div className={`bridge__card c-${color}`}>
        <div className="shape" style={{ background: `var(--${shape})` }} />
        <div><span className="label">{label}</span><h2>{title}</h2></div>
        <div><p>{text}</p><Link className={`btn ${color === "yellow" ? "btn--ink" : "btn--yellow"} btn--lg`} href={href}>{cta} <span className="arr">→</span></Link></div>
      </div>
    </section>
  );
}

export function Footer({ id, title, text, primary, secondary }: { id: string; title: ReactNode; text: string; primary: { href: string; label: string; external?: boolean }; secondary: { href: string; label: string; external?: boolean } }) {
  const ext = (e?: boolean) => (e ? { target: "_blank", rel: "noopener noreferrer" } : {});
  return (
    <footer className="cta" id={id}>
      <div className="cta__top">
        <h2>{title}</h2>
        <div className="cta__side">
          <p>{text}</p>
          <div className="row">
            <a className="btn btn--yellow btn--lg" href={primary.href} {...ext(primary.external)}>{primary.label} <span className="arr">→</span></a>
            <a className="btn btn--secondary btn--lg" href={secondary.href} {...ext(secondary.external)}>{secondary.label}</a>
          </div>
        </div>
      </div>
      <div className="foot">
        <div><h5 className="label">Produto</h5><Link href="/">Para empresas</Link><Link href="/criadores">Para criadores</Link><Link href="/login">Entrar</Link></div>
        <div><h5 className="label">Empresas</h5><Link href="/#painel">Dashboard</Link><Link href="/#agente">Agente IA</Link><Link href="/#como-funciona">Como funciona</Link></div>
        <div><h5 className="label">Criadores</h5><Link href="/criadores#recursos">Loja</Link><Link href="/criadores#recursos">Cursos</Link><Link href="/criadores#precos">Preços</Link></div>
        <div><h5 className="label">Inboxy</h5><span style={{ color: "#a3a09a", lineHeight: "30px", fontSize: 15 }}>Um produto Braxen Tech</span></div>
      </div>
      <div className="legal"><span>© {new Date().getFullYear()} Inboxy · Braxen Tech</span><span>Atendimento, vendas e agenda em um só lugar.</span></div>
      <div className="mega" aria-hidden="true" id="mega">Inboxy</div>
    </footer>
  );
}
