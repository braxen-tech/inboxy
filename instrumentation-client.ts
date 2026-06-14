import posthog from "posthog-js";
import { getClientDeploymentEnvironment } from "@/lib/deployment-environment";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const deploymentEnvironment = getClientDeploymentEnvironment();

if (key) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-sensitive]",
    },
  });
  posthog.register({
    deployment_environment: deploymentEnvironment,
    $environment: deploymentEnvironment,
  });
}
