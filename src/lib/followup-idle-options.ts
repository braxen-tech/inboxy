export interface FollowupIdleOption {
  minutes: number;
  label: string;
}

export const FOLLOWUP_IDLE_OPTIONS: readonly FollowupIdleOption[] = [
  { minutes: 30, label: "30 minutos" },
  { minutes: 40, label: "40 minutos" },
  { minutes: 50, label: "50 minutos" },
  { minutes: 60, label: "1 hora" },
  { minutes: 120, label: "2 horas" },
  { minutes: 180, label: "3 horas" },
  { minutes: 240, label: "4 horas" },
  { minutes: 300, label: "5 horas" },
  { minutes: 360, label: "6 horas" },
  { minutes: 420, label: "7 horas" },
  { minutes: 480, label: "8 horas" },
  { minutes: 540, label: "9 horas" },
  { minutes: 600, label: "10 horas" },
  { minutes: 660, label: "11 horas" },
  { minutes: 720, label: "12 horas" },
] as const;

export const DEFAULT_FOLLOWUP_IDLE_MINUTES = 60;

const ALLOWED_MINUTES = new Set(FOLLOWUP_IDLE_OPTIONS.map((o) => o.minutes));

export function isAllowedFollowupIdleMinutes(minutes: number): boolean {
  return ALLOWED_MINUTES.has(minutes);
}

export function normalizeFollowupIdleMinutes(minutes: number): number {
  return isAllowedFollowupIdleMinutes(minutes)
    ? minutes
    : DEFAULT_FOLLOWUP_IDLE_MINUTES;
}

export function formatFollowupIdleLabel(minutes: number): string {
  const option = FOLLOWUP_IDLE_OPTIONS.find((o) => o.minutes === minutes);
  return option?.label ?? `${minutes} minutos`;
}
