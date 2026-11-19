# Inboxy

Inboxy é a plataforma onde **quem cria vende** e **quem atende automatiza**. Dois públicos, uma marca:

- **Criadores** — montam a própria loja com link, vendem cursos, e-books, templates e mentorias, recebem por PIX/cartão/boleto e entregam tudo automaticamente.
- **Empresas** — conectam o chatbot (agente IA no WhatsApp, Instagram, Facebook, TikTok) e acompanham tudo num dashboard: conversas, vendas, agendamentos, desempenho do bot.

O sistema nasceu do site atual (inboxy.braxentech.com: azul elétrico, amarelo de destaque, Geist) e foi levado a um tom mais editorial e impactante, inspirado em sites de marca com tipografia gigante e animação guiada pelo scroll.

## Fundamentos de conteúdo

- **Idioma:** português do Brasil, tratamento por "você".
- **Voz:** direta, confiante, sem jargão técnico. Frases curtas. Verbos no imperativo nos CTAs ("Crie sua loja", "Conecte seu bot").
- **Títulos gigantes** são de 1–3 palavras, terminam em ponto: *VENDA. ATENDA. CRESÇA.*
- **Números concretos** vencem adjetivos: "Do cadastro à primeira venda em minutos", "A partir de R$ 97/mês".
- **Sem emoji** na interface da marca. Ícones de traço quando necessário.
- Valores sempre em `R$ 1.234,56` (formato brasileiro) e na família `mono`.

| Faça | Evite |
| --- | --- |
| "Seu bot responde, vende e agenda." | "Solução omnichannel de IA conversacional." |
| "Grátis para começar." | "Experimente nossa incrível plataforma!" |

## Fundamentos visuais

### Cor

- **`blue` (Inboxy Blue)** é a marca e o público **Criadores**. Use em blocos grandes, não em pinceladas: o hero, a seção-palco, o botão primário.
- **`coral`** é o público **Empresas**. Quando a página troca de público, o palco troca de `blue` para `blue-night` com acentos `coral`.
- **`yellow` (Amarelo Sinal)** marca UMA coisa por tela: a palavra-chave do título, um selo, o preço. Sempre com `ink`/`on-accent` por cima.
- **`paper`** é quente (não branco puro); `surface` é o branco dos cards e mockups.
- `success`, `warning`, `danger` aparecem só em estados de dado (pagamento, bot online) e sempre com ícone + rótulo, nunca só cor.
- Contraste: todo texto ≥ 4.5:1 nos dois temas. Texto branco só sobre `blue` e `blue-night`; texto sobre `yellow` e `coral` é sempre `on-accent`.

### Tipografia

- **Display — Bricolage Grotesque (Google Fonts)**, 700–800, tracking negativo, caixa alta nos tamanhos `display-xxl`/`display-xl`. É a voz da marca.
- **Texto — Geist (Google Fonts)**, herdada do produto atual.
- **Dados — Geist Mono**, para valores, horários e métricas do dashboard.
- Carregue: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap`.

### Forma, espaço e profundidade

- Raios generosos: cards `radius-lg`, mockups `radius-xl`, botões e chips `radius-pill`.
- Grid de 12 colunas, gutter `space-6` (desktop) / `space-4` (mobile); seções com `space-9` de respiro vertical.
- Profundidade com `shadow-card` em mockups flutuantes; `shadow-pop` só para o objeto-herói; `shadow-sticker` (sombra dura) para selos.
- Sem gradientes azul-roxo, sem cards com borda esquerda colorida.

### Movimento (site)

Referência principal: dialedcoffee.com; secundária: henrietta.wearetattoodigital.com.

- **Smooth scroll** (Lenis) + **GSAP ScrollTrigger**.
- **Hero palco:** título gigante fixo; o objeto-herói (celular com a loja) sobe de baixo e gira levemente enquanto um bloco `blue` cresce de baixo para cima.
- **Seção fixada com troca:** o palco fica preso enquanto o scroll troca o conteúdo (Criadores ↔ Empresas), mudando a cor de fundo e a palavra-gigante.
- **Elementos flutuantes** (balões de chat, notificações de pagamento) em parallax com velocidades diferentes.
- **Letras que sobem** uma a uma nos títulos gigantes; frases-manifesto que acendem palavra a palavra.
- **Scroll horizontal** fixado para a lista de produtos/recursos.
- Easing padrão `power3.out` / `expo.out`, durações 0.6–1.2s. Respeite `prefers-reduced-motion`: sem pin nem parallax, só fades.

## Iconografia

Traço de 1.75px, cantos arredondados, 20/24px, cor `currentColor` (ex.: Lucide). Ícones de canal (WhatsApp, Instagram etc.) só em monocromo `ink`.

## Componentes

`Button`, `Badge`, `ChatBubble`, `StatCard`, `ProductCard` — classes CSS em `components/bundle.css` (prefixo `ibx-`), todas sobre os tokens.
