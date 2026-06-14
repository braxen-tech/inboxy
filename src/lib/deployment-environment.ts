export type DeploymentEnvironment = "production" | "staging" | "development" | "preview";

const VALID: DeploymentEnvironment[] = [
  "production",
  "staging",
  "development",
  "preview",
];

function parseExplicit(value: string | undefined): DeploymentEnvironment | null {
  if (!value) return null;
  return VALID.includes(value as DeploymentEnvironment)
    ? (value as DeploymentEnvironment)
    : null;
}

/** Server-side deployment label for logs, traces, and analytics. */
export function getServerDeploymentEnvironment(): DeploymentEnvironment {
  const explicit =
    parseExplicit(process.env.DEPLOYMENT_ENV) ??
    parseExplicit(process.env.NEXT_PUBLIC_DEPLOYMENT_ENV);
  if (explicit) return explicit;

  if (!process.env.VERCEL) return "development";
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_GIT_COMMIT_REF === "staging") return "staging";
  return "preview";
}

/** Client-side deployment label (NEXT_PUBLIC_* only). */
export function getClientDeploymentEnvironment(): DeploymentEnvironment {
  return parseExplicit(process.env.NEXT_PUBLIC_DEPLOYMENT_ENV) ?? "development";
}

export function getPostHogServiceName(environment: DeploymentEnvironment): string {
  return environment === "production" ? "inboxy" : `inboxy-${environment}`;
}

export function getPostHogTelemetryProperties(): Record<string, string> {
  const environment = getServerDeploymentEnvironment();
  return {
    deployment_environment: environment,
    $environment: environment,
  };
}
