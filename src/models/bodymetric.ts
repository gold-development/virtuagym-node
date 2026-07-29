import { z } from 'zod';

/** The bodymetric types documented as assignable via the API. */
export const bodymetricTypes = [
  'weight',
  'height',
  'bmi',
  'fat',
  'waist',
  'number_crunches',
  'number_lunges',
  'number_pushups_knees',
  'number_pushups',
  'hr_exercise',
  'hr_rest',
  'visceral',
  'musclemass',
  'muscle_perc',
  'metabolicrate',
  'metabolicage',
  'bonemass',
  'bonemass_percent',
  'bodywater',
] as const;

export type BodymetricType = (typeof bodymetricTypes)[number];

/** One bodymetric history entry of a member. */
export const bodymetricSchema = z.object({
  id: z.number(),
  /** Undocumented; the linked user account id (not the member_id). */
  user_id: z.number().optional(),
  /**
   * The metric type. Live data contains undocumented types (e.g.
   * "sleep_score") beyond the documented BodymetricType values.
   */
  type: z.string(),
  value: z.number(),
  /** Unit depending on the member's settings; may be empty. */
  unit: z.string().optional(),
  /** Timestamp of the measurement, in seconds. */
  timestamp: z.number(),
  /** 0/1 in the wire format; normalized to boolean. */
  deleted: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .transform((v) => v === true || v === 1)
    .optional(),
  /** Undocumented; timestamp (seconds) of the last edit. */
  timestamp_edit: z.number().optional(),
});

export type Bodymetric = Readonly<z.infer<typeof bodymetricSchema>>;

/** Response of a bodymetric update. */
export const bodymetricUpdatedSchema = z.object({
  /** The id of the created/updated bodymetric entry. */
  id: z.number(),
});

export type BodymetricUpdated = Readonly<
  z.infer<typeof bodymetricUpdatedSchema>
>;
