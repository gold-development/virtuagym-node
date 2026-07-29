import { z } from 'zod';

/** A check-in/check-out visit of a member, as shown in Visitor Registration. */
export const visitSchema = z.object({
  /** The unique identifier of the visit. */
  id: z.number(),
  club_id: z.number(),
  /** The member who triggered the visit. */
  member_id: z.number(),
  /** Timestamp (ms) of the check-in. */
  check_in_timestamp: z.number(),
  /** Timestamp (ms) of the check-out; 0 while the member is checked in. */
  check_out_timestamp: z.number(),
  /** Documented values: "ok", "warning", "rejected". */
  status: z.string(),
  /** Supplementary text of the visit. */
  status_message: z.string().optional(),
});

export type Visit = Readonly<z.infer<typeof visitSchema>>;

/** Response of a successful check-in/check-out registration. */
export const visitRegisteredSchema = z.object({
  /** The visit id; check-in and check-out of one visit share the same id. */
  id: z.number(),
  member_id: z.number(),
  /** E.g. "check in registered". */
  message: z.string().optional(),
});

export type VisitRegistered = Readonly<z.infer<typeof visitRegisteredSchema>>;
