import { z } from 'zod';

export const clubEventSchema = z.object({
  /**
   * The unique identifier of the event. The docs declare an int, but the
   * API returns strings like "1945791969-54d4caf4db7821-10175268"; numbers
   * are coerced to strings for a stable type.
   */
  event_id: z.union([z.string(), z.number()]).transform(String),
  /** The schedule to which the event belongs. */
  schedule_id: z.number(),
  /** Datetime ("YYYY-MM-DD HH:mm:ss") the event starts, in the club timezone. */
  start: z.string(),
  /** Datetime ("YYYY-MM-DD HH:mm:ss") the event ends, in the club timezone. */
  end: z.string(),
  /** The name of the event in the default club language. */
  title: z.string(),
  /** Reference to an Activity Definition. */
  activity_id: z.number(),
  /** Any enclosing note to the employee about the event. */
  employee_note: z.string().optional(),
  club_id: z.number(),
  /** The id of the instructor (0 when none). */
  instructor_id: z.number().optional(),
  /** The number of active participants in the event. */
  attendees: z.number().optional(),
  /** The number of maximum possible participants in the event. */
  max_places: z.number().optional(),
  /** Whether the event is bookable: 1 = true, 0 = false. */
  bookable: z.union([z.literal(0), z.literal(1)]).optional(),
  /** Timestamp before which the event can be cancelled. */
  cancel_before_duration: z.number().optional(),
  /** Duration before which the event can be booked, e.g. "1 months". */
  booking_in_advance_duration: z.string().optional(),
  /** Whether the event was cancelled. */
  canceled: z.boolean().optional(),
  /** Shorthand language of the event (e.g. "en", "nl"); may be empty. */
  language: z.string().optional(),
  /**
   * Whether the instructor confirmed presence; participant information is
   * only reliable when true.
   */
  presence_saved: z.boolean().optional(),
});

export type ClubEvent = Readonly<z.infer<typeof clubEventSchema>>;
