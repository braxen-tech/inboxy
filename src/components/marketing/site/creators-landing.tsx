import { buildBraxenWhatsAppUrl } from "@/lib/braxen-contact";
import { SiteRoot } from "./site-root";
import {
  Bridge, Chip, Float, Footer, GiantWord, Hero, HorizontalCards, IconCalendar, IconCheck,
  Loader, Nav, Quotes, Statement, Steps, StorePhone,
} from "./parts";

/** /criadores — store for content creators (courses, digital products, mentoring). */
export function CreatorsLanding() {
  const whatsapp = buildBraxenWhatsAppUrl();

  return (
    <SiteRoot>
      <Loader />
      <Nav
        links={[
          { href: "#recursos", label: "O que vender" },
          { href: "#precos", label: "Preços" },
          { href: "#como-funciona", label: "Como funciona" },
        ]}
        switchLink={{ href: "/", label: "Para empresas" }}
        cta={{ href: "/login", label: "Criar minha loja" }}
      />
      <main id="top">
        <Hero
          words={["Venda.", "Entregue.", "Cresça."]}
          title="Inboxy para criadores — sua loja com link próprio para cursos, e-books e mentorias"
          meta="Sua loja de criador, completa: cursos, e-books e mentorias em uma vitrine só sua."
          panelTitle={<>Sua loja de criador. <em>Completa.</em></>}
          panelText="Compartilhe seu link, receba por PIX, cartão ou boleto e entregue tudo automaticamente."
          panelActions={
            <>
              <a className="btn btn--yellow btn--lg" href="/login">Criar minha loja grátis <span className="arr">→</span></a>
              <a className="btn btn--ghost-light btn--lg" href="#recursos">O que posso vender?</a>
            </>
          }
          rightBig="R$ 0"
          rightSmall="para começar · sem cartão de crédito"
          phone={
            <StorePhone
              initial="M" name="Mariana Costa" url="inboxy.store/marianacosta" chips={["Personal trainer", "4,9 ★"]} cta="Ver loja completa →"
              products={[
                { t: "C", tone: "blue", name: "Curso: Treino em Casa", meta: "12 aulas · acesso imediato", price: "R$ 197" },
                { t: "M", tone: "coral", name: "Mentoria individual", meta: "60 min · agenda integrada", price: "R$ 149" },
                { t: "E", tone: "yellow", name: "E-book: Guia de Nutrição", meta: "PDF · entrega por e-mail", price: "R$ 39" },
              ]}
            />
          }
          floats={
            <>
              <Float speed={1.6} style={{ left: "7%", top: "62%" }}><Chip icon={<IconCheck />} tone="yellow" title="Pagamento recebido" sub="+R$ 197,00 · PIX" /></Float>
              <Float speed={1.2} style={{ right: "8%", top: "30%" }}><Chip icon={<IconCalendar />} tone="coral" title="Mentoria agendada" sub="amanhã · 14:00" /></Float>
              <Float speed={2} style={{ right: "14%", top: "70%" }}><div className="bub bub--bot">Oi! Já te mandei o link do curso!<small>Agente IA · WhatsApp</small></div></Float>
              <Float speed={0.8} style={{ left: "16%", top: "24%" }}><div className="bub bub--in">Ainda tem vaga na mentoria?<small>Instagram · 09:41</small></div></Float>
              <Float speed={2.4} style={{ left: "40%", top: "16%" }}><div className="coin">R$</div></Float>
              <Float speed={1.4} style={{ right: "30%", top: "80%" }}><div className="coin" style={{ width: 48, height: 48, fontSize: 16 }}>+1</div></Float>
            </>
          }
        />

        <Statement
          label="Uma loja · tudo automático"
          aside="Substitua o Linktree, a Hotmart, o Calendly e o Gumroad por uma só plataforma."
          asideCta={{ href: "#precos", label: "Ver quanto economizo" }}
        >
          Você cria o <span className="b">conteúdo</span>. O Inboxy cuida da <span className="b">vitrine</span>, do pagamento, da entrega e do acesso — <span className="y">e você só acompanha as vendas.</span>
        </Statement>

        <HorizontalCards
          id="recursos"
          title={<>Tudo o que<br />você cria.</>}
          lead="Uma vitrine para cada formato. Você foca no conteúdo; pagamento, entrega e acesso acontecem sozinhos."
          cards={[
            { color: "blue", shape: "yellow", title: "Cursos online", text: "Módulos e aulas em vídeo. Seus alunos acompanham o progresso no portal deles, sem app.", tag: "Substitui Kajabi, Hotmart" },
            { color: "yellow", shape: "coral", title: "Produtos digitais", text: "E-books, templates e planilhas entregues no e-mail do comprador assim que o pagamento cai.", tag: "Substitui Gumroad" },
            { color: "ink", shape: "blue", title: "Mentorias", text: "Sessões individuais com agenda integrada e link de pagamento.", tag: "Substitui Calendly" },
            { color: "coral", shape: "ink", title: "Lives com replay", text: "Transmita para seus alunos e deixe a gravação disponível na área de membros.", tag: "Substitui Zoom, StreamYard" },
            { color: "white", shape: "blue", title: "E-mail para sua base", text: "Avise lançamentos e promoções para quem já comprou de você.", tag: "Substitui Mailchimp" },
            { color: "night", shape: "coral", title: "Agente IA 24/7", text: "Responde DMs, tira dúvidas e manda o link de compra enquanto você dorme.", tag: "Substitui ManyChat" },
          ]}
        />

        <section className="allin" id="precos" aria-label="Preço">
          <GiantWord text="Tudo em 1." />
          <h2 className="sr">Tudo em uma plataforma</h2>
          <div className="allin__grid">
            <div className="tools" id="tools">
              {[
                ["Loja com link próprio", "Linktree, Squarespace"],
                ["Agente IA 24/7", "ManyChat, Chatfuel"],
                ["Cursos e área de membros", "Kajabi, Hotmart"],
                ["Agenda de mentorias", "Calendly, Acuity"],
                ["Produtos digitais", "Gumroad"],
                ["Lives com replay", "Zoom, StreamYard"],
                ["E-mail para sua base", "Mailchimp, ConvertKit"],
                ["PIX, cartão e boleto", "Stripe, PagSeguro"],
              ].map(([a, b]) => (
                <div className="tool" key={a}><b>{a}</b><s>{b}</s></div>
              ))}
            </div>
            <div className="price" id="price">
              <span className="label">Se contratasse tudo separado</span>
              <div><span className="old" id="oldPrice">~R$ 930/mês</span></div>
              <span className="label">Com o Inboxy, a partir de</span>
              <div className="new">R$ <span id="newPrice">97</span><small>/mês</small></div>
              <p>Grátis para começar. Sem cartão de crédito.</p>
              <a className="btn btn--yellow btn--lg" href="/login">Começar grátis <span className="arr">→</span></a>
            </div>
          </div>
        </section>

        <Steps
          title="Do cadastro à primeira venda em minutos."
          steps={[
            { k: "01", title: "Crie sua conta", text: "Cadastre-se e monte sua loja em minutos. Sem cartão de crédito.", meta: "2 min", color: "white" },
            { k: "02", title: "Adicione seus produtos", text: "Cursos, e-books, templates ou mentorias — tudo em um só painel.", meta: "5 min", color: "yellow" },
            { k: "03", title: "Compartilhe seu link", text: "Cole na bio do Instagram, no status do WhatsApp ou onde preferir.", meta: "1 clique", color: "blue" },
            { k: "04", title: "Receba e entregue", text: "Pagamentos, entregas e acessos acontecem de forma automática.", meta: "24/7", color: "ink" },
          ]}
        />

        <Quotes
          title={<>Quem usa,<br />vende.</>}
          rows={[
            [
              { text: "Em um mês já tinha mais de 30 alunos. E eu não precisei me preocupar com nada técnico.", name: "Mariana Costa", role: "Personal trainer", tone: "coral" },
              { text: "Publiquei meu e-book e vendi nas primeiras horas — sem precisar de site, sem nada.", name: "Ana Carvalho", role: "Criadora de conteúdo", tone: "ink", yellow: true },
              { text: "Coloquei meu curso no ar em uma tarde. O portal do aluno já veio pronto.", name: "Rafael Mendes", role: "Coach de carreira", tone: "blue" },
            ],
            [
              { text: "Meus clientes chegam pelo link, compram e recebem o acesso sozinhos. É automático.", name: "Juliana Ferreira", role: "Educadora online", tone: "yellow" },
              { text: "Finalmente um lugar só para os meus produtos. Antes eu mandava PDF por WhatsApp.", name: "Carlos Lima", role: "Designer e criador", tone: "coral" },
              { text: "Vendi minha primeira mentoria no mesmo dia que criei a loja.", name: "Pedro Alves", role: "Consultor de negócios", tone: "ink", yellow: true },
            ],
          ]}
        />

        <Bridge
          color="night"
          shape="coral"
          label="Tem uma empresa?"
          title={<>Conheça o<br />Inboxy empresas.</>}
          text="Agente IA no WhatsApp e no Instagram, agenda, pagamentos e um dashboard completo para o seu atendimento."
          href="/"
          cta="Ver Inboxy para empresas"
        />

        <Footer
          id="comecar"
          title={<>Pronto pra<br /><span className="y">vender sozinho?</span></>}
          text="Crie sua loja hoje. Grátis para começar."
          primary={{ href: "/login", label: "Criar minha loja" }}
          secondary={{ href: whatsapp, label: "Falar no WhatsApp", external: true }}
        />
      </main>
    </SiteRoot>
  );
}
