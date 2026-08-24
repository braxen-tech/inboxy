import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground">
        Esta loja não existe ou não está disponível.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
