import { notFound } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getOrgBySlug } from "@/lib/get-org";
import { listCatalogItems, type CatalogItem } from "@/infrastructure/adapters/stripe/catalog-admin";
import { logger } from "@/lib/logger";
import { CatalogManager } from "./catalog-manager";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function CatalogPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const connected = org.stripe_account_status === "active" && !!org.stripe_account_id;

  let items: CatalogItem[] = [];
  let loadError = false;
  if (connected) {
    try {
      items = await listCatalogItems(org.stripe_account_id as string);
    } catch (err) {
      loadError = true;
      logger.error("Catalog list failed", { orgSlug, error: String(err) });
    }
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h1">Catálogo</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Produtos e preços que o agente de IA oferece e cobra. Ficam salvos no seu Stripe.
        </Typography>
      </div>

      {!connected ? (
        <Alert
          severity="warning"
          action={
            <Button href={`/${orgSlug}/integrations`} color="inherit" size="small">
              Conectar
            </Button>
          }
        >
          Conecte o Stripe em Integrações para cadastrar produtos e receber pagamentos.
        </Alert>
      ) : loadError ? (
        <Alert severity="error">Não foi possível carregar os produtos do Stripe. Tente novamente em instantes.</Alert>
      ) : (
        <CatalogManager orgSlug={orgSlug} items={items} />
      )}
    </Stack>
  );
}
