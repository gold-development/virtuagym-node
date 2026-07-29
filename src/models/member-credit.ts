import { z } from 'zod';

/**
 * The credits of one member in one service type. Rows have no unique id;
 * identity is the (member_id, service_type) pair.
 */
export const memberCreditSchema = z.object({
  club_id: z.number(),
  member_id: z.number(),
  /** Normalized service type, e.g. "access", "solarium", "test-credit". */
  service_type: z.string(),
  credit_amount: z.number(),
  credit_unlimited: z.boolean(),
  /** Undocumented; present on a few rows. Timestamp in seconds. */
  ts_needs_update: z.number().optional(),
  /** Timestamp in SECONDS (the docs claim milliseconds). */
  timestamp_created: z.number(),
  timestamp_edited: z.number(),
});

export type MemberCredit = Readonly<z.infer<typeof memberCreditSchema>>;

/** Response of a credit allocation. */
export const creditTransactionSchema = z.object({
  member_id: z.number(),
  /**
   * "Transaction completed", or "Already picked up or completed" when the
   * same client_id was already processed (idempotent replay).
   */
  message: z.string().optional(),
});

export type CreditTransaction = Readonly<
  z.infer<typeof creditTransactionSchema>
>;
