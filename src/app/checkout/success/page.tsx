import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-950/20 dark:to-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Pagamento confirmado!</CardTitle>
          <CardDescription className="text-base mt-2">
            Seu pagamento foi processado com sucesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Você já pode voltar à conversa — enviamos uma confirmação com os próximos passos.
          </p>
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">O que acontece agora?</p>
            <p>
              Nosso assistente já foi notificado do seu pagamento e vai continuar o atendimento
              automaticamente no chat.
            </p>
          </div>
          {session_id && (
            <p className="text-xs text-muted-foreground/60 font-mono truncate">
              Ref: {session_id}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
