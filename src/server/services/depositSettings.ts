import { prisma } from "@/server/db/prisma";

export const DEFAULT_DEPOSIT_PAYMENT_DEADLINE_HOURS = 1;
export const MIN_DEPOSIT_PAYMENT_DEADLINE_HOURS = 1;
export const MAX_DEPOSIT_PAYMENT_DEADLINE_HOURS = 168;
export const DEPOSIT_PAYMENT_DEADLINE_SETTING_KEY =
  "DEPOSIT_PAYMENT_DEADLINE_HOURS";

export function parseDepositPaymentDeadlineHours(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.trunc(parsed);
  if (
    normalized < MIN_DEPOSIT_PAYMENT_DEADLINE_HOURS ||
    normalized > MAX_DEPOSIT_PAYMENT_DEADLINE_HOURS
  ) {
    return null;
  }

  return normalized;
}

export async function getDepositPaymentDeadlineHours() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: DEPOSIT_PAYMENT_DEADLINE_SETTING_KEY },
  });

  return (
    parseDepositPaymentDeadlineHours(setting?.value) ??
    DEFAULT_DEPOSIT_PAYMENT_DEADLINE_HOURS
  );
}

export function getDepositPaymentDeadline(input: {
  scheduledStart: Date;
  deadlineHours: number;
}) {
  return new Date(
    input.scheduledStart.getTime() - input.deadlineHours * 60 * 60 * 1000,
  );
}

export function isBeforeDepositPaymentDeadline(input: {
  scheduledStart: Date;
  deadlineHours: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return (
    getDepositPaymentDeadline({
      scheduledStart: input.scheduledStart,
      deadlineHours: input.deadlineHours,
    }).getTime() > now.getTime()
  );
}

export function getExpiredPendingBookingCutoff(input: {
  now: Date;
  deadlineHours: number;
}) {
  return new Date(input.now.getTime() + input.deadlineHours * 60 * 60 * 1000);
}

export function formatDepositDeadlineLabel(hours: number) {
  return `${hours} jam`;
}
