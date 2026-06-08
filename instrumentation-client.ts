import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

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
}
