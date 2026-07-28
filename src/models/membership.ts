import { z } from 'zod';

// The membership-instance endpoint returns real booleans, but the docs for
// member-embedded memberships show 0/1; accept both and normalize to boolean.
const flag = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((v) => v === true || v === 1);

/** A membership instance (contract) of a member. */
export const membershipInstanceSchema = z.object({
  /** The id of the membership instance. */
  instance_id: z.number(),
  /** The id of the club member. */
  member_id: z.number(),
  /** The id of the membership definition. */
  membership_id: z.number(),
  active: flag,
  /** Manually cancelled by an employee with termination in the future. */
  cancelled: flag,
  /** Already renewed at this point (vs still in its initial period). */
  contract_autorenewed: flag,
  /** Reached the contract end date automatically and was not renewed. */
  completed: flag,
  /** Paused by an employee. */
  paused: flag,
  /** Manually cancelled by an employee with immediate termination. */
  stopped: flag,
  /** The actual start date of the membership (yyyy-mm-dd). */
  start_date: z.string(),
  /** The contractual start date of the membership (yyyy-mm-dd). */
  contract_start_date: z.string(),
  /** The contractual end date of the membership (yyyy-mm-dd). */
  contract_end_date: z.string(),
  membership_name: z.string(),
});

export type MembershipInstance = Readonly<
  z.infer<typeof membershipInstanceSchema>
>;

/** The contract returned when creating a membership instance. */
export const membershipContractSchema = z.object({
  /** Contract ID. */
  id: z.number(),
  /** Documented as string but returned as number; coerced to string. */
  contract_number: z.union([z.string(), z.number()]).transform(String),
  membership_id: z.number(),
  member_id: z.number(),
  start_date: z.string(),
  contract_start_date: z.string().optional(),
  contract_end_date: z.string().optional(),
  contract_active: z.boolean().optional(),
  contract_payment_method: z.string().optional(),
  discount_id: z.number().optional(),
  discount_name: z.string().optional(),
  discount_amount: z.number().optional(),
  /** Docs list "percentage"/"monetary", but their examples show "percent". */
  discount_amount_type: z.string().optional(),
  discount_start_date: z.string().optional(),
  discount_duration: z
    .object({
      discount_duration_time: z.number().nullable().optional(),
      discount_duration_term: z.string().nullable().optional(),
    })
    .optional(),
});

export type MembershipContract = Readonly<
  z.infer<typeof membershipContractSchema>
>;

export const membershipAccessTimeSchema = z.object({
  /** Day of the week, e.g. "Monday". */
  day: z.string(),
  /** HH:mm:ss. */
  start_time: z.string(),
  end_time: z.string(),
});

export type MembershipAccessTime = Readonly<
  z.infer<typeof membershipAccessTimeSchema>
>;

export const membershipClubTaxSchema = z.object({
  /** Returned as number or numeric string; coerced to number. */
  tax_id: z.coerce.number(),
  tax_name: z.string().optional(),
  tax_percentage: z.coerce.number().optional(),
});

export type MembershipClubTax = Readonly<
  z.infer<typeof membershipClubTaxSchema>
>;

/** A membership definition (the product a club sells). */
export const membershipDefinitionSchema = z.object({
  membership_id: z.number(),
  membership_name: z.string(),
  membership_group: z.string().optional(),
  membership_notes: z.string().optional(),
  /** YYYY-MM-DD. */
  membership_availability_start: z.string().optional(),
  membership_availability_end: z.string().optional(),
  membership_available_online: z.boolean().optional(),
  membership_duration: z.number().optional(),
  /** "weeks" or "months". */
  membership_duration_type: z.string().optional(),
  membership_auto_renew: z.boolean().optional(),
  membership_pro_rata_start: z.boolean().optional(),
  membership_renew_duration: z.number().optional(),
  membership_renew_term: z.string().optional(),
  membership_renew_before: z.number().optional(),
  membership_renew_before_term: z.string().optional(),
  membership_renew_price: z.number().optional(),
  membership_price: z.number().optional(),
  /** "total", "monthly", "weekly" or "four_weekly". */
  membership_price_term: z.string().optional(),
  membership_income_category: z.string().optional(),
  membership_registration_fee: z.number().optional(),
  membership_club_tax: membershipClubTaxSchema.optional(),
  membership_billing_cycle: z.string().optional(),
  default_payment_method: z.string().optional(),
  tmp_default_payment_method: z.string().optional(),
  /** YYYY-MM-DD. */
  membership_creation_date: z.string().optional(),
  membership_last_edit_date: z.string().optional(),
  /** E.g. "10 days", "1 weeks". */
  membership_invoice_creation_term: z.string().optional(),
  access_times: z.array(membershipAccessTimeSchema).optional(),
});

export type MembershipDefinition = Readonly<
  z.infer<typeof membershipDefinitionSchema>
>;
