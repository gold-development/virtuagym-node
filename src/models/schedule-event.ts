import { z } from 'zod';

// The v3 schedule (appointment) API is documented only by Swagger specs and
// could not be verified live yet (requires the schedule integration scope on
// the OAuth client), so these schemas keep every non-identifying field
// optional and tolerate nulls.

/** Payment info of a participant's booking. */
export const schedulePaymentInfoSchema = z.object({
  paid_status: z.boolean().nullable().optional(),
  amount: z.number().nullable().optional(),
  credit_type: z.string().nullable().optional(),
});

export type SchedulePaymentInfo = Readonly<
  z.infer<typeof schedulePaymentInfoSchema>
>;

/** A member booked into a schedule event. */
export const scheduleParticipantSchema = z.object({
  member_id: z.number(),
  /** The member's id in the super club (superclub setups only). */
  original_member_id: z.number().nullable().optional(),
  name: z.string().optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
  presence: z.boolean().nullable().optional(),
  deleted: z.boolean().optional(),
  payment_info: schedulePaymentInfoSchema.nullable().optional(),
});

export type ScheduleParticipant = Readonly<
  z.infer<typeof scheduleParticipantSchema>
>;

/** A guest (non-member) booked into a schedule event. */
export const scheduleGuestSchema = z.object({
  // Integer in the events spec, string in the bookings spec.
  external_id: z.union([z.string(), z.number()]).nullable().optional(),
  email: z.string().nullable().optional(),
  name: z.string().optional(),
  phone_number: z.string().nullable().optional(),
  presence: z.boolean().nullable().optional(),
  follow_up_as_lead: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export type ScheduleGuest = Readonly<z.infer<typeof scheduleGuestSchema>>;

/** Booking-rule ranges configured on the activity (minutes; -1 = disabled). */
export const scheduleActivitySettingsSchema = z.object({
  bookable_till_range: z
    .object({
      regular_access: z.number().nullable().optional(),
      early_access: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  booking_closes_range: z.number().nullable().optional(),
  free_cancellation_range: z.number().nullable().optional(),
  cancellation_range: z.number().nullable().optional(),
  min_time_between_bookings_range: z.number().nullable().optional(),
  reschedule_range: z.number().nullable().optional(),
});

export type ScheduleActivitySettings = Readonly<
  z.infer<typeof scheduleActivitySettingsSchema>
>;

export const scheduleActivityCategorySchema = z.object({
  category_guid: z.string(),
  category_name: z.string().optional(),
  /** Locale → translated fields, e.g. { en: { category_name } }. */
  trans: z.record(z.string(), z.unknown()).nullable().optional(),
  category_type: z.number().optional(),
  /** 0-3; how the instructor name is displayed. */
  instructor_name_display: z.number().optional(),
  /** 0 or 1. */
  capacity_display: z.number().optional(),
});

export type ScheduleActivityCategory = Readonly<
  z.infer<typeof scheduleActivityCategorySchema>
>;

/** Credit cost of booking the activity. */
export const scheduleEventCostSchema = z.object({
  credit_guid: z.string().nullable().optional(),
  credit_name: z.string().nullable().optional(),
  credit_amount: z.number().nullable().optional(),
  credit_priority: z.number().nullable().optional(),
});

export type ScheduleEventCost = Readonly<
  z.infer<typeof scheduleEventCostSchema>
>;

export const scheduleActivitySchema = z.object({
  activity_id: z.number(),
  activity_name: z.string().optional(),
  activity_description: z.string().nullable().optional(),
  /** Locale → translated fields, e.g. { en: { activity_name } }. */
  trans: z.record(z.string(), z.unknown()).nullable().optional(),
  image: z.string().nullable().optional(),
  visibility: z.number().optional(),
  settings: scheduleActivitySettingsSchema.nullable().optional(),
  category: scheduleActivityCategorySchema.nullable().optional(),
  costs: z.array(scheduleEventCostSchema).nullable().optional(),
  tryout_enabled: z.boolean().optional(),
});

export type ScheduleActivity = Readonly<z.infer<typeof scheduleActivitySchema>>;

export const scheduleStaffSchema = z.object({
  staff_guid: z.string().nullable().optional(),
  staff_member_id: z.number().nullable().optional(),
  staff_name: z.string().nullable().optional(),
  staff_image: z.string().nullable().optional(),
});

export type ScheduleStaff = Readonly<z.infer<typeof scheduleStaffSchema>>;

export const scheduleLocationSchema = z.object({
  location_id: z.string().nullable().optional(),
  location_name: z.string().nullable().optional(),
  /** Locale → translated fields, e.g. { en: { location_name } }. */
  trans: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ScheduleLocation = Readonly<z.infer<typeof scheduleLocationSchema>>;

/**
 * An event on the club's appointment schedule (v3). The bookings list
 * endpoint returns the same shape with only the booking-related fields
 * populated.
 */
export const scheduleEventSchema = z.object({
  /** E.g. "1945791969-54d4caf4db7821-10175268". */
  event_id: z.string(),
  /** UTC milliseconds. */
  datetime_start: z.number(),
  /** UTC milliseconds. */
  datetime_end: z.number(),
  /** UTC milliseconds. */
  created_timestamp: z.number().optional(),
  /** UTC milliseconds. */
  updated_timestamp: z.number().optional(),
  meeting_link: z.string().nullable().optional(),
  spots_left: z.number().nullable().optional(),
  capacity: z.number().nullable().optional(),
  track_participants_presence: z.number().nullable().optional(),
  participants_presence_confirmed: z.boolean().nullable().optional(),
  deleted: z.boolean().optional(),
  title: z.string().nullable().optional(),
  activity: scheduleActivitySchema.nullable().optional(),
  location: scheduleLocationSchema.nullable().optional(),
  staff: scheduleStaffSchema.nullable().optional(),
  participants: z.array(scheduleParticipantSchema).nullable().optional(),
  guests: z.array(scheduleGuestSchema).nullable().optional(),
});

export type ScheduleEvent = Readonly<z.infer<typeof scheduleEventSchema>>;
