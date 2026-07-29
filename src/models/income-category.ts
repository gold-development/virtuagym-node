import { z } from 'zod';

export const incomeCategorySchema = z.object({
  /**
   * The GUID of the income category. An older docs revision shows numeric
   * ids; numbers are coerced to strings for a stable type.
   */
  income_category_id: z.union([z.string(), z.number()]).transform(String),
  /** Display name of the income category. */
  income_category_name: z.string(),
  /** Undocumented; returned by the live API. */
  name_id: z.string().optional(),
  /** Name of the default tax assigned to this category; null if not set. */
  default_tax: z.string().nullable().optional(),
  /** The ID of the tax associated with the category; null if not set. */
  default_tax_id: z.number().nullable().optional(),
});

export type IncomeCategory = Readonly<z.infer<typeof incomeCategorySchema>>;
