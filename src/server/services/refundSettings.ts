import { prisma } from "@/server/db/prisma";

export const DEFAULT_REFUND_REQUEST_DEADLINE_HOURS = 12;
export const MIN_REFUND_REQUEST_DEADLINE_HOURS = 1;
export const MAX_REFUND_REQUEST_DEADLINE_HOURS = 168;
export const REFUND_REQUEST_DEADLINE_SETTING_KEY =
  "REFUND_REQUEST_DEADLINE_HOURS";

export function parseRefundRequestDeadlineHours(value: unknown): number | null {
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
    normalized < MIN_REFUND_REQUEST_DEADLINE_HOURS ||
    normalized > MAX_REFUND_REQUEST_DEADLINE_HOURS
  ) {
    return null;
  }

  return normalized;
}

export async function getRefundRequestDeadlineHours() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: REFUND_REQUEST_DEADLINE_SETTING_KEY },
  });

  return (
    parseRefundRequestDeadlineHours(setting?.value) ??
    DEFAULT_REFUND_REQUEST_DEADLINE_HOURS
  );
}

export function getRefundRequestDeadline(input: {
  scheduledStart: Date;
  deadlineHours: number;
}) {
  return new Date(
    input.scheduledStart.getTime() - input.deadlineHours * 60 * 60 * 1000,
  );
}

export function isBeforeRefundRequestDeadline(input: {
  scheduledStart: Date;
  deadlineHours: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return (
    getRefundRequestDeadline({
      scheduledStart: input.scheduledStart,
      deadlineHours: input.deadlineHours,
    }).getTime() > now.getTime()
  );
}
