import { z } from 'zod';

/** A membership instance as embedded by `with=memberships`/`active_memberships`. */
export const membershipInstanceSchema = z.object({
  instance_id: z.number(),
  member_id: z.number(),
  membership_id: z.number(),
  /** 1 = true, 0 = false. */
  active: z.union([z.literal(0), z.literal(1)]).optional(),
  cancelled: z.union([z.literal(0), z.literal(1)]).optional(),
  contract_autorenewed: z.union([z.literal(0), z.literal(1)]).optional(),
  completed: z.union([z.literal(0), z.literal(1)]).optional(),
  paused: z.union([z.literal(0), z.literal(1)]).optional(),
  stopped: z.union([z.literal(0), z.literal(1)]).optional(),
  /** YYYY-MM-DD. */
  start_date: z.string().optional(),
  contract_start_date: z.string().optional(),
  contract_end_date: z.string().optional(),
  membership_name: z.string().optional(),
});

export type MembershipInstance = Readonly<
  z.infer<typeof membershipInstanceSchema>
>;

export const memberSchema = z.object({
  /** The ID for the member ("Member ID" in Virtuagym). */
  member_id: z.number(),
  /** The ID of the club the member belongs to (a sub-club in case of a chain). */
  club_id: z.number(),
  /** Custom ID from the external system ("Own member ID" in Virtuagym). */
  club_member_id: z.string().optional(),
  /** ID for the member from the external system. */
  external_id: z.string().optional(),
  firstname: z.string(),
  lastname: z.string(),
  /** An invitation may be sent to this address when the member is created. */
  email: z.string(),
  active: z.boolean(),
  is_pro: z.boolean(),
  /** Documented as "m"/"f", but "u" (unspecified) occurs in live data. */
  gender: z.string().optional(),
  /**
   * When the member made an account: a timestamp in ms in live responses,
   * but the docs also show a "YYYY-MM-DD" string.
   */
  member_since: z.union([z.number(), z.string()]),
  /** Timestamp (ms) the member's information last changed. Used as pagination cursor. */
  timestamp_edit: z.number(),
  /** The birthday of the member (YYYY-MM-DD). */
  birthday: z.string().optional(),
  /** The language the member uses in the portal (e.g. 'en', 'nl'). */
  lang: z.string().optional(),
  zip: z.string().optional(),
  street: z.string().optional(),
  street_extra: z.string().optional(),
  place: z.string().optional(),
  /** The country code where the member lives. */
  country: z.string().optional(),
  /** A nicely formatted string of the street address of the member. */
  formatted_address: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  /** Rf-ID tag that is tied to the member. */
  rfid_tag: z.string().optional(),
  /** If the member has early booking access. */
  early_booking_access: z.boolean().optional(),
  /** Only present when requested via the `with` option. */
  memberships: z.array(membershipInstanceSchema).optional(),

  // The fields below are returned by the live API but are not documented;
  // they are optional because their presence across clubs is unverified.

  /** Timestamp (ms) the member was registered. Undocumented. */
  registration_date: z.number().optional(),
  /** Undocumented. */
  original_member_id: z.number().optional(),
  /** ID of the linked user account. Undocumented; absent for some members. */
  user_id: z.number().optional(),
  /** Undocumented. */
  business_guid: z.string().optional(),
});

export type Member = Readonly<z.infer<typeof memberSchema>>;
