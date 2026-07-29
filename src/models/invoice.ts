import { z } from 'zod';

/** A row (child) of an invoice. */
export const invoiceRowSchema = z.object({
  guid: z.string(),
  /** The connected contract id, when the row relates to a contract. */
  contract_id: z.number().optional(),
  /** The connected product id, when the row relates to a product. */
  retail_product_id: z.number().optional(),
  /** Undocumented. */
  sales_user_id: z.number().optional(),
  product_name: z.string(),
  product_desc: z.string().optional(),
  product_count: z.number(),
  /** Price including VAT. */
  price: z.number(),
  price_ex_vat: z.number(),
  vat: z.number(),
  /** Currency code, e.g. "EUR". */
  currency: z.string(),
  payment_method: z.string().optional(),
  /** Undocumented. */
  new_payment_method: z.string().optional(),
  /** YYYY-MM-DD; shown in docs examples but absent from the field table. */
  start_period: z.string().optional(),
  end_period: z.string().optional(),
  is_concept: z.boolean().optional(),
  deleted: z.boolean(),
  income_category: z.string().optional(),
  /** The position of this row in the parent invoice. */
  position: z.number().optional(),
  /** E.g. "api_created". */
  origin: z.string().optional(),
  /** The timestamp (date) of the invoice (seconds). */
  timestamp: z.number(),
  timestamp_paid: z.number().optional(),
  timestamp_edit: z.number(),
  timestamp_created: z.number(),
  club_tax_id: z.number(),
  club_tax_name: z.string().optional(),
  club_tax_perc: z.number().optional(),
  /** Undocumented. */
  related_invoice: z.string().optional(),
});

export type InvoiceRow = Readonly<z.infer<typeof invoiceRowSchema>>;

/** A parent invoice with its rows. */
export const invoiceSchema = z.object({
  guid: z.string(),
  /** The id of the invoice (0 if the invoice is a concept). */
  id: z.number().optional(),
  contract_id: z.number().optional(),
  retail_product_id: z.number().optional(),
  member_id: z.number().optional(),
  /** Undocumented. */
  sales_user_id: z.number().optional(),
  /** The guid of the optional business connected to the invoice. */
  business_guid: z.string().optional(),
  invoice_text_guid: z.string().optional(),
  club_id: z.number(),
  name: z.string(),
  desc: z.string().optional(),
  /** Total price including VAT. */
  price: z.number(),
  price_ex_vat: z.number(),
  /** Currency code, e.g. "EUR". */
  currency: z.string(),
  payment_method: z.string().optional(),
  /** Undocumented. */
  new_payment_method: z.string().optional(),
  paid: z.boolean(),
  /** 0 open, 1 pending, 2 paid. */
  paid_status: z.number().optional(),
  amount_due: z.number(),
  is_offer: z.boolean().optional(),
  is_temporary: z.boolean().optional(),
  is_sent: z.boolean().optional(),
  is_concept: z.boolean().optional(),
  deleted: z.boolean(),
  /** The timestamp (date) of the invoice (seconds). */
  timestamp: z.number(),
  timestamp_paid: z.number().optional(),
  timestamp_edit: z.number(),
  timestamp_created: z.number(),
  /** Undocumented. */
  timestamp_status: z.number().optional(),
  extra_invoice_field_1: z.string().optional(),
  extra_invoice_field_2: z.string().optional(),
  extra_invoice_field_3: z.string().optional(),
  employee_extra_field: z.string().optional(),
  /** Undocumented. */
  invoice_related_invoice: z.string().optional(),
  /** Undocumented. */
  free_invoice_text: z.string().optional(),
  rows: z.array(invoiceRowSchema),
});

export type Invoice = Readonly<z.infer<typeof invoiceSchema>>;
