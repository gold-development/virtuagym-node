import { z } from 'zod';

export const clubTaxSchema = z.object({
  /**
   * Undocumented numeric id; this is the id referenced by invoice rows
   * (club_tax_id) and membership-instance creation (tax_id).
   */
  club_tax_id: z.number().optional(),
  /** The GUID of the club tax (the docs table wrongly declares an int). */
  tax_id: z.union([z.string(), z.number()]).transform(String),
  /** The name of the club tax, e.g. "BTW 21%". */
  tax_name: z.string(),
  /** The percentage value as a decimal string, e.g. "21.00". */
  tax_perc: z.string(),
  /** The start date (YYYY-MM-DD) when the club tax becomes active. */
  date_from: z.string().optional(),
});

export type ClubTax = Readonly<z.infer<typeof clubTaxSchema>>;
