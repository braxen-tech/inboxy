import type { Metadata } from "next";
import { CreatorsLanding } from "@/components/marketing/site/creators-landing";

export const metadata: Metadata = {
  title: "Inboxy para criadores — sua loja de cursos, e-books e mentorias",
  description:
    "Crie sua loja com link próprio, venda cursos, e-books e mentorias e receba por PIX, cartão ou boleto. Entrega automática e grátis para começar.",
};

export default function CreatorsPage() {
  return <CreatorsLanding />;
}
