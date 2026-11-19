import { buildBraxenWhatsAppUrl } from "@/lib/braxen-contact";
import { SiteRoot } from "./site-root";
import {
  Bridge, ChatPhone, Chip, Float, Footer, GiantWord, Hero, HorizontalCards, IconCalendar, IconCheck,
  Loader, Nav, Statement, Steps, StickyDashboard,
} from "./parts";

/** Home page — focused on companies (chatbot + dashboard). */
export function BusinessLanding() {
  const whatsapp = buildBraxenWhatsAppUrl();

  return (
    <SiteRoot>
      <Loader />
      <Nav
        links={[
          { href: "#painel", label: "Dashboard" },
          { href: "#agente", label: "Agente IA" },
          { href: "#como-funciona", label: "Como funciona" },
        ]}
        switchLink={{ href: "/criadores", label: "Para criadores" }}
        cta={{ href: "#comecar", label: "Falar com especialista" }}
      />
      <main id="top">
        <Hero
          words={["Atenda.", "Venda.", "Agende."]}
          title="Inboxy — atenda, venda e agende em todos os canais com um agente IA"
          meta="O agente IA da sua empresa no WhatsApp, Instagram e site — e um painel que mostra tudo."
          panelTitle={<>Seu atendimento no automático. <em>Em todos os canais.</em></>}
          panelText="Conecte o WhatsApp e as redes da sua empresa. O agente responde, envia link de pagamento e agenda horários — e você acompanha tudo em tempo real."
          panelActions={
            <>
              <a className="btn btn--yellow btn--lg" href={whatsapp} target="_blank" rel="noopener noreferrer">Falar com especialista <span className="arr">→</span></a>
              <a className="btn btn--ghost-light btn--lg" href="#painel">Ver o painel</a>
            </>
          }
          rightBig="24/7"
          rightSmall="atendimento que não dorme"
          phone={<ChatPhone />}
          floats={
            <>
              <Float speed={1.6} style={{ left: "7%", top: "62%" }}><Chip icon={<IconCheck />} tone="yellow" title="Pagamento recebido" sub="+R$ 120,00 · PIX" /></Float>
              <Float speed={1.2} style={{ right: "8%", top: "30%" }}><Chip icon={<IconCalendar />} tone="coral" title="Horário agendado" sub="amanhã · 16:00" /></Float>
              <Float speed={2} style={{ right: "14%", top: "70%" }}><div className="bub bub--bot">Posso te ajudar com mais alguma coisa?<small>Agente IA · Instagram</small></div></Float>
              <Float speed={0.8} style={{ left: "16%", top: "24%" }}><div className="bub bub--in">Vocês abrem sábado?<small>WhatsApp · 09:41</small></div></Float>
              <Float speed={2.4} style={{ left: "40%", top: "16%" }}><div className="coin">IA</div></Float>
              <Float speed={1.4} style={{ right: "30%", top: "80%" }}><div className="coin" style={{ width: 48, height: 48, fontSize: 16 }}>+1</div></Float>
            </>
          }
        />

        <Statement
          label="Atendimento · vendas · agenda"
          aside="Troque o ManyChat, o Calendly, os links de pagamento soltos e as planilhas por um só lugar."
          asideCta={{ href: "#painel", label: "Ver o painel" }}
        >
          Seu cliente chama no <span className="b">WhatsApp</span>, no Instagram ou no site. O Inboxy <span className="b">responde</span>, tira dúvidas, cobra e agenda — <span className="y">e você só acompanha os resultados.</span>
        </Statement>

        <StickyDashboard
          id="painel"
          label="Para empresas"
          title={<>Seu bot.<br />Seu painel.<br />Seu controle.</>}
          features={[
            { hl: "dInbox", num: "01 — Conectar", title: "Conecte os canais da sua empresa", text: "Traga seu número de WhatsApp e suas redes. Em minutos, todas as conversas chegam em uma única caixa de entrada.", tags: ["WhatsApp", "Instagram", "Facebook", "Chat no site"] },
            { hl: "dInbox", num: "02 — Automatizar", title: "Um agente IA que resolve", text: "Treinado com as informações do seu negócio, ele responde, envia link de pagamento e agenda horários. Quando precisa, passa para um humano." },
            { hl: "dStats", num: "03 — Acompanhar", title: "Veja tudo em tempo real", text: "Receita, conversas, taxa de resolução, agendamentos. Cada número com histórico e comparação." },
            { hl: "dChart", num: "04 — Crescer", title: "Decida com dados, não com achismo", text: "Descubra quais canais vendem mais, em que horário seus clientes chamam e onde o bot precisa de ajuda.", cta: { href: "#comecar", label: "Falar com especialista" } },
          ]}
        />

        <HorizontalCards
          id="agente"
          title={<>O que o<br />agente faz.</>}
          lead="Um atendente que conhece o seu negócio, trabalha 24 horas e nunca deixa cliente sem resposta."
          cards={[
            { color: "blue", shape: "yellow", title: "Responde dúvidas", text: "Preços, horários, endereço, políticas — tudo a partir da sua base de conhecimento.", tag: "Base de conhecimento" },
            { color: "yellow", shape: "coral", title: "Agenda horários", text: "Mostra os horários livres e confirma o agendamento na própria conversa.", tag: "Substitui Calendly" },
            { color: "ink", shape: "blue", title: "Vende e cobra", text: "Envia link de pagamento por PIX ou cartão e avisa quando o pagamento cai.", tag: "PIX · cartão" },
            { color: "coral", shape: "ink", title: "Chama um humano", text: "Quando o assunto pede, transfere para sua equipe com todo o histórico.", tag: "Sem cliente perdido" },
            { color: "white", shape: "blue", title: "Dispara campanhas", text: "Avise promoções e novidades para sua base de contatos em poucos cliques.", tag: "Disparos" },
            { color: "night", shape: "coral", title: "Fala em todo canal", text: "WhatsApp, Instagram, Facebook e chat no site — com a mesma inteligência.", tag: "Substitui ManyChat" },
          ]}
        />

        <section className="allin" aria-label="Para quem">
          <GiantWord text="24/7." />
          <h2 className="sr">Atendimento 24 horas, 7 dias por semana</h2>
          <div className="allin__grid">
            <div className="segs" id="tools">
              <div className="seg"><span>01</span><div><b>Clínicas e consultórios</b><small>Agendamento, lembretes e dúvidas sobre procedimentos.</small></div></div>
              <div className="seg"><span>02</span><div><b>Salões e barbearias</b><small>Horários livres, confirmação e pagamento antecipado.</small></div></div>
              <div className="seg"><span>03</span><div><b>Lojas e e-commerce</b><small>Catálogo, status de pedido e link de pagamento.</small></div></div>
              <div className="seg"><span>04</span><div><b>Prestadores de serviço</b><small>Orçamentos, visitas e acompanhamento do cliente.</small></div></div>
            </div>
            <div className="price impl" id="price">
              <span className="label">Implementação sob medida</span>
              <div className="new" style={{ marginTop: 16 }}>Pronto em dias.</div>
              <p>Nossa equipe configura os canais, treina o agente com as informações do seu negócio e acompanha os primeiros resultados com você.</p>
              <a className="btn btn--yellow btn--lg" href={whatsapp} target="_blank" rel="noopener noreferrer">Falar no WhatsApp <span className="arr">→</span></a>
            </div>
          </div>
        </section>

        <Steps
          title="Do primeiro contato ao atendimento no automático."
          steps={[
            { k: "01", title: "Conecte seus canais", text: "WhatsApp, Instagram, Facebook e o chat do seu site em uma só caixa de entrada.", meta: "Minutos", color: "white" },
            { k: "02", title: "Treine o agente", text: "Envie preços, serviços, horários e políticas. O agente aprende com a sua base de conhecimento.", meta: "1 dia", color: "yellow" },
            { k: "03", title: "Ative a agenda e os pagamentos", text: "Conecte sua agenda e seus pagamentos para o agente marcar e cobrar sozinho.", meta: "1 clique", color: "blue" },
            { k: "04", title: "Acompanhe no painel", text: "Conversas, vendas, agendamentos e desempenho do bot, em tempo real.", meta: "24/7", color: "ink" },
          ]}
        />

        <Bridge
          color="yellow"
          shape="blue"
          label="É criador de conteúdo?"
          title={<>Tem uma loja<br />pra você também.</>}
          text="Venda cursos, e-books e mentorias com seu próprio link — com pagamento e entrega automáticos."
          href="/criadores"
          cta="Conhecer o Inboxy para criadores"
        />

        <Footer
          id="comecar"
          title={<>Pronto pra<br /><span className="y">atender sozinho?</span></>}
          text="Fale com um especialista e coloque o agente da sua empresa no ar."
          primary={{ href: whatsapp, label: "Falar no WhatsApp", external: true }}
          secondary={{ href: "/login", label: "Começar no painel" }}
        />
      </main>
    </SiteRoot>
  );
}
