import { z } from 'zod';

/**
 * Documented lead statuses (v3 leads API):
 * 1 New, 2 Contacted, 3 In Contact, 4 Appointment made, 5 Appointment held,
 * 6 Free Trial, 7 Sign up scheduled, 8 No show, 9 Closed refused,
 * 10 Closed lost contact, 11 Closed disqualified, 12 Closed won,
 * 13 Closed - third party aggregators.
 */
export const leadStatuses = {
  1: 'New',
  2: 'Contacted',
  3: 'In Contact',
  4: 'Appointment made',
  5: 'Appointment held',
  6: 'Free Trial',
  7: 'Sign up scheduled',
  8: 'No show',
  9: 'Closed refused',
  10: 'Closed lost contact',
  11: 'Closed disqualified',
  12: 'Closed won',
  13: 'Closed - third party aggregators',
} as const;

export type LeadStatusId = keyof typeof leadStatuses;

/**
 * A lead as returned by the v3 leads API.
 *
 * NOTE: the live API serializes every field as a string — ids, flags
 * ("0"/"1") and timestamps (SECONDS since epoch) included. Empty values are
 * empty strings, except birthday which can be null.
 */
export const leadSchema = z.object({
  lead_id: z.string(),
  lead_guid: z.string(),
  club_id: z.string(),
  /** See {@link leadStatuses} for the documented values. */
  status_id: z.string(),
  source_id: z.string(),
  /** Member id of the staff member who owns the lead; "0" when unset. */
  owner_id: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  email: z.string(),
  phone: z.string(),
  mobile: z.string(),
  /** "f" = female, "m" = male; empty when unset. */
  gender: z.string(),
  /** YYYY-MM-DD, or null when unset. */
  birthday: z.string().nullable(),
  address: z.string(),
  address_2: z.string(),
  zip_code: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  language: z.string(),
  picture: z.string(),
  /** Member id once the lead converted; "0" otherwise. */
  converted_to_member_id: z.string(),
  external_id: z.string(),
  /** YYYY-MM-DD. */
  lead_since: z.string().nullable(),
  created_by_user_id: z.string(),
  edited_by_user_id: z.string(),
  /** "0" or "1". */
  deleted: z.string(),
  /** Timestamp in SECONDS, as a string. */
  timestamp_created: z.string(),
  /** Timestamp in SECONDS, as a string. */
  timestamp_edited: z.string(),
  /** "0" or "1". */
  inactive: z.string(),
});

export type Lead = Readonly<z.infer<typeof leadSchema>>;

/**
 * Undocumented: the leads list response includes an owners map (owner_id →
 * staff member) alongside the leads.
 */
export const leadOwnerSchema = z.object({
  member_id: z.string(),
  firstname: z.string(),
  lastname: z.string(),
});

export type LeadOwner = Readonly<z.infer<typeof leadOwnerSchema>>;
