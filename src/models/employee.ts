import { z } from 'zod';

/** Privileges supported by the employee endpoints. 'default' is added for each employee. */
export const employeePrivileges = [
  'club_manager',
  'assistent_manager',
  'marketing_manager',
  'coach',
  'financial',
  'employee',
  'scheduling',
  'default',
] as const;

export type EmployeePrivilege = (typeof employeePrivileges)[number];

export const employeeSchema = z.object({
  /** The ID for the employee ("Member ID" in Virtuagym). */
  member_id: z.number(),
  /** The ID of the club the employee belongs to (a sub-club in case of a chain). */
  club_id: z.number(),
  /** Custom ID from the external system ("Own member ID" in Virtuagym). */
  club_member_id: z.string().optional(),
  /** ID from the external system. */
  external_id: z.string().optional(),
  firstname: z.string(),
  lastname: z.string(),
  /** An invitation is sent to this address when the employee is created. */
  email: z.string(),
  active: z.boolean(),
  is_pro: z.boolean(),
  /** Documented as "m"/"f", but "u" (unspecified) occurs in live data. */
  gender: z.string().optional(),
  /** Timestamp (ms) the employee made an account. */
  member_since: z.number(),
  /** Timestamp (ms) the employee's information last changed. Used as pagination cursor. */
  timestamp_edit: z.number(),
  /** The birthday of the employee (YYYY-MM-DD). */
  birthday: z.string().optional(),
  /** The language the employee uses in the portal (e.g. 'en', 'nl'). */
  lang: z.string().optional(),
  zip: z.string().optional(),
  street: z.string().optional(),
  street_extra: z.string().optional(),
  place: z.string().optional(),
  /** The country code where the employee lives. */
  country: z.string().optional(),
  /** A nicely formatted string of the street address of the employee. */
  formatted_address: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  /** Rf-ID tag that is tied to the employee. */
  rfid_tag: z.string().optional(),
  /**
   * Comma-separated privileges, e.g. "default,club_manager". Known values:
   * club_manager, assistent_manager, marketing_manager, coach, financial,
   * employee, scheduling, default. Spelling matches the API's wire format.
   */
  priviliges: z.string().optional(),

  // The fields below are returned by the live API but are not documented;
  // they are optional because their presence across clubs is unverified.

  /** Timestamp (ms) the employee was registered. Undocumented. */
  registration_date: z.number().optional(),
  /** Undocumented. */
  original_member_id: z.number().optional(),
  /** ID of the linked user account. Undocumented; absent for some employees. */
  user_id: z.number().optional(),
  /** Undocumented. */
  early_booking_access: z.boolean().optional(),
});

export type Employee = Readonly<z.infer<typeof employeeSchema>>;
