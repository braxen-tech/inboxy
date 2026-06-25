import { MarketingHeader } from "@/components/marketing/marketing-header";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (
    !supabaseUrl.trim() ||
    !supabaseAnonKey.trim() ||
    supabaseUrl.includes("placeholder")
  ) {
    return (
      <div className="flex min-h-screen flex-col">
        <MarketingHeader showAuthButton={false} />
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="max-w-md text-center text-sm text-destructive">
            Configuração inválida: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
            em <code className="rounded bg-muted px-1">.env.local</code>, rode{" "}
            <code className="rounded bg-muted px-1">rm -rf .next</code> e reinicie{" "}
            <code className="rounded bg-muted px-1">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResetPasswordForm
      supabaseUrl={supabaseUrl.trim()}
      supabaseAnonKey={supabaseAnonKey.trim()}
    />
  );
}
