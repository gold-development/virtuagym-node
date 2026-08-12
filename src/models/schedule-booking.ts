import { z } from 'zod';

/**
 * Reason codes reported per booking attempt by the v3 schedule API.
 */
export const bookingReasonCodes = {
  1: 'ok',
  2: 'participant_added',
  101: 'not_available',
  102: 'participant_already_there',
  103: 'full_book',
  105: 'not_credits',
  108: 'outside_min_time_between_bookings',
  114: 'too_early_to_book',
  115: 'booking_disabled',
  116: 'booking_disabled_reached_no_show_limit',
} as const;

export type BookingReasonCode = keyof typeof bookingReasonCodes;

/**
 * One booking attempt in the response of creating a booking.
 *
 * day/time_start/time_end are CLUB-LOCAL (verified live: an 11:00 UTC
 * event books as "13:00:00" for a Europe/Amsterdam club), unlike the UTC
 * millisecond datetimes used everywhere else in the schedule API.
 */
export const bookingAttemptSchema = z.object({
  booked: z.boolean(),
  /** YYYY-MM-DD, club-local. */
  day: z.string().optional(),
  /** See {@link bookingReasonCodes}. */
  reason: z.number().optional(),
  /** HH:MM:SS, club-local. */
  time_start: z.string().optional(),
  /** HH:MM:SS, club-local. */
  time_end: z.string().optional(),
  /** Timestamp (ms) when a booking block expires; only when blocked. */
  booking_blocked_until: z.number().optional(),
});

export type BookingAttempt = Readonly<z.infer<typeof bookingAttemptSchema>>;

/** Response of creating a booking on a schedule event. */
export const bookingCreatedSchema = z.object({
  bookings: z.array(bookingAttemptSchema).default([]),
  total_bookings: z.number().optional(),
});

export type BookingCreated = Readonly<z.infer<typeof bookingCreatedSchema>>;
