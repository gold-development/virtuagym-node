import { z } from 'zod';

/** A booking of a member (or guest) into a club event. */
export const eventParticipantSchema = z.object({
  /** The unique identifier of the event participant (booking). */
  event_participant_id: z.number(),
  /**
   * The event the booking belongs to. The docs declare an int, but the API
   * returns strings like "1977058374-54d4cab74fd424-52808265"; numbers are
   * coerced to strings for a stable type.
   */
  event_id: z.union([z.string(), z.number()]).transform(String),
  /** The member who is a participant in the event. */
  member_id: z.number(),
  email_address: z.string().optional(),
  /** The name of the guest; only filled when fillGuestname is requested. */
  user_name: z.string().optional(),
  /** Notes accompanying the booking (max 255 characters). */
  notes: z.string().optional(),
  /** Whether the member was present in the event. */
  present: z.boolean().optional(),
  /** Why the member was not present. */
  absence_reason: z.string().optional(),
  /** Whether the member paid for the event. */
  has_paid: z.boolean().optional(),
  /** Whether the ticket was printed for the participation. */
  ticket_printed: z.boolean().optional(),
  /** Timestamp the resource was last modified/created. */
  timestamp_edit: z.number(),
});

export type EventParticipant = Readonly<z.infer<typeof eventParticipantSchema>>;

/** Response of a successful booking creation. */
export const eventParticipantCreatedSchema = z.object({
  member_id: z.number(),
  event_id: z.union([z.string(), z.number()]).transform(String),
  event_participant_id: z.number(),
  /** E.g. "Added member to event". */
  message: z.string().optional(),
});

export type EventParticipantCreated = Readonly<
  z.infer<typeof eventParticipantCreatedSchema>
>;
