import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const plans = [
  {
    name: "Inboxy Starter",
    description: "Plano Starter — 500 mensagens/mês, Cal.com, Loja Stripe",
    metadata: { plan: "starter" },
    unitAmount: 9700, // R$97,00
    envVar: "STRIPE_PRICE_ID_STARTER",
  },
  {
    name: "Inboxy Professional",
    description: "Plano Professional — 2.000 mensagens/mês, Cal.com, Loja Stripe",
    metadata: { plan: "professional" },
    unitAmount: 29700, // R$297,00
    envVar: "STRIPE_PRICE_ID_PROFESSIONAL",
  },
  {
    name: "Inboxy Business",
    description: "Plano Business — 10.000 mensagens/mês, Cal.com, Loja Stripe, suporte prioritário",
    metadata: { plan: "business" },
    unitAmount: 69700, // R$697,00
    envVar: "STRIPE_PRICE_ID_BUSINESS",
  },
];

for (const plan of plans) {
  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: plan.metadata,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.unitAmount,
    currency: "brl",
    recurring: { interval: "month" },
    metadata: plan.metadata,
  });

  console.log(`${plan.envVar}=${price.id}  # ${plan.name}`);
}
