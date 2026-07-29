import { z } from 'zod';

export const noteTypes = [
  'general',
  'coaching',
  'products',
  'invoices',
  'files',
  'checkup',
] as const;

export type NoteType = (typeof noteTypes)[number];

/** A note on a club member's clients & staff page. */
export const memberNoteSchema = z.object({
  note_id: z.number(),
  /** The member to whom the note belongs. */
  member_id: z.number(),
  /** Undocumented; the user who wrote the note. */
  from_user_id: z.number().optional(),
  from_user_avatar: z.string().optional(),
  from_user_name: z.string().optional(),
  /** Timestamp the note was created — in SECONDS, unlike most endpoints. */
  timestamp: z.number(),
  note_text: z.string(),
  /** Documented values: general, coaching, products, invoices, files, checkup. */
  note_type: z.string(),
  deleted: z.boolean().optional(),
});

export type MemberNote = Readonly<z.infer<typeof memberNoteSchema>>;

/** Response of a successful note creation. */
export const memberNoteCreatedSchema = z.object({
  member_id: z.number(),
  note_id: z.number(),
  /** E.g. "POST note successful". */
  note: z.string().optional(),
});

export type MemberNoteCreated = Readonly<
  z.infer<typeof memberNoteCreatedSchema>
>;
