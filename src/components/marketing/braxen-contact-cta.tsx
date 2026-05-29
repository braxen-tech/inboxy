import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buildBraxenWhatsAppUrl } from "@/lib/braxen-contact";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BraxenContactCta() {
  const whatsappUrl = buildBraxenWhatsAppUrl();

  return (
    <section id="contato" className="border-b py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-muted/40 px-6 py-12 text-center sm:px-10">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-500/15">
            <MessageCircle className="size-6 text-green-600" aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Quer implementação sob medida?
          </h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            O Inboxy é um produto da{" "}
            <span className="font-medium text-foreground">Braxen Tech</span>. Para
            setup personalizado, integrações extras ou suporte na implantação, fale
            com a mesma equipe do site Braxen — pelo WhatsApp.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-w-[200px] bg-green-600 text-white hover:bg-green-700",
              )}
            >
              Falar no WhatsApp
            </a>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-[200px]")}
            >
              Começar no painel
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
