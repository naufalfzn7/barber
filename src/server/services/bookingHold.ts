export const PENDING_BOOKING_HOLD_MINUTES = 10;

export function getPendingBookingHoldExpiresAt(createdAt: Date): Date {
  return new Date(
    createdAt.getTime() + PENDING_BOOKING_HOLD_MINUTES * 60 * 1000,
  );
}

export function getPendingBookingHoldCutoff(now = new Date()): Date {
  return new Date(
    now.getTime() - PENDING_BOOKING_HOLD_MINUTES * 60 * 1000,
  );
}

export function getEarlierDeadline(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}
