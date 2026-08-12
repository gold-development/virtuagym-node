import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  leadOwnerSchema,
  leadSchema,
  type Lead,
  type LeadStatusId,
} from '../models/lead';
import {
  bookingCreatedSchema,
  type BookingCreated,
} from '../models/schedule-booking';
import {
  scheduleEventSchema,
  type ScheduleEvent,
} from '../models/schedule-event';
import type { VirtuaGymClientV3Options } from './virtuagym-client-v3-options';

const TOKEN_URL =
  'https://iam.services.virtuagym.com/auth/realms/virtuagym/protocol/openid-connect/token';
const GATEWAY_URL = 'https://gateway.services.virtuagym.com';

/**
 * An error reported by the Virtuagym v3 API. Unlike v1, the v3 endpoints
 * use real HTTP status codes for errors.
 */
export class VirtuaGymV3ApiError extends Error {
  constructor(
    /** The HTTP status code of the response. */
    public readonly httpStatus: number,
    message: string,
    /** Invalid fields, when the endpoint reports them. */
    public readonly fields?: readonly string[],
  ) {
    super(`Virtuagym API v3 error ${httpStatus}: ${message}`);
    this.name = 'VirtuaGymV3ApiError';
  }
}

/**
 * Client for the Virtuagym v3 API (OAuth client credentials).
 *
 * Access tokens are requested and renewed automatically. Which resources
 * are available depends on the scopes Virtuagym registered for the OAuth
 * client: the schedule endpoints require the schedule integration scope and
 * answer 401 "Token not valid." without it, even with valid credentials.
 */
export class VirtuaGymClientV3 {
  private readonly http: AxiosInstance;
  private token?: { accessToken: string; expiresAt: number };

  constructor(private readonly options: VirtuaGymClientV3Options) {
    this.http = axios.create();
  }

  /** Retrieves every lead of the club across all pages. */
  public async allLeads(options: LeadsOptions = {}): Promise<Lead[]> {
    const leads: Lead[] = [];
    for await (const page of this.leads(options)) {
      leads.push(...page);
    }
    return leads;
  }

  /**
   * Yields leads page by page, fetching each page lazily — the next request
   * is only made when the consumer asks for the next page.
   *
   * The page/limit parameters are undocumented but verified live; the API
   * defaults to 25 leads per page and ignores page_size/offset/sync_from.
   */
  public async *leads(
    options: LeadsOptions = {},
  ): AsyncGenerator<Lead[], void, undefined> {
    const limit = options.limit ?? 100;

    for (let page = 1; ; page++) {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const envelope = await this.request(leadsEnvelopeSchema, {
        method: 'get',
        path: `v3/clubs/${this.options.clubId}/leads`,
        params,
      });
      const leads = envelope?.data.leads ?? [];
      if (leads.length > 0) {
        yield leads;
      }
      // The API reports no total; a short page means we reached the end.
      if (leads.length < limit) {
        return;
      }
    }
  }

  /**
   * Retrieves a single lead by its id.
   *
   * Throws {@link VirtuaGymV3ApiError} (httpStatus 404) when the lead does
   * not exist. This endpoint is undocumented but verified live.
   */
  public async lead(leadId: number | string): Promise<Lead> {
    const envelope = await this.request(leadEnvelopeSchema, {
      method: 'get',
      path: `v3/clubs/${this.options.clubId}/leads/${encodeURIComponent(leadId)}`,
    });
    if (!envelope) {
      throw new VirtuaGymV3ApiError(
        404,
        `Lead ${leadId} was not found in the response`,
      );
    }
    return envelope.data.lead;
  }

  /**
   * Creates a new lead and returns the canonical record (re-fetched, since
   * the mutation response only contains the new id).
   *
   * At least one of email, phone or mobile is required by the API.
   */
  public async createLead(data: CreateLeadData): Promise<Lead> {
    return this.mutateLead(
      { method: 'post', path: `v3/clubs/${this.options.clubId}/leads` },
      data,
    );
  }

  /**
   * Updates an existing lead and returns the canonical record.
   *
   * Throws {@link VirtuaGymV3ApiError} (httpStatus 404) when the lead does
   * not exist.
   */
  public async updateLead(
    leadId: number | string,
    data: UpdateLeadData,
  ): Promise<Lead> {
    return this.mutateLead(
      {
        method: 'put',
        path: `v3/clubs/${this.options.clubId}/leads/${encodeURIComponent(leadId)}`,
      },
      data,
    );
  }

  /** Retrieves every schedule event in the date range across all pages. */
  public async allEvents(
    options: ScheduleEventsOptions,
  ): Promise<ScheduleEvent[]> {
    const events: ScheduleEvent[] = [];
    for await (const page of this.events(options)) {
      events.push(...page);
    }
    return events;
  }

  /**
   * Yields schedule events page by page, fetching each page lazily.
   *
   * Requires the schedule integration scope on the OAuth client; without it
   * the API answers 401 "Token not valid.".
   */
  public async *events(
    options: ScheduleEventsOptions,
  ): AsyncGenerator<ScheduleEvent[], void, undefined> {
    const pageSize = options.pageSize ?? 100;

    for (let page = 1; ; page++) {
      const params = new URLSearchParams();
      params.set('date_start', options.dateStart.toString());
      params.set('date_end', options.dateEnd.toString());
      params.set('page', page.toString());
      params.set('page_size', pageSize.toString());
      if (options.deleted !== undefined) {
        params.set('deleted', options.deleted.toString());
      }
      if (options.eventType) {
        params.set('event_type', options.eventType);
      }

      const envelope = await this.request(scheduleEventsEnvelopeSchema, {
        method: 'get',
        path: `private/v3/clubs/${this.options.clubId}/schedule/integration/events`,
        params,
      });
      const events = envelope?.data.events ?? [];
      if (events.length > 0) {
        yield events;
      }
      const totalPages = envelope?.data.total_pages;
      if (events.length === 0 || page >= (totalPages ?? page)) {
        return;
      }
    }
  }

  /**
   * Retrieves a single schedule event by its event_id.
   *
   * Throws {@link VirtuaGymV3ApiError} (httpStatus 404) when the event does
   * not exist.
   */
  public async event(eventId: string): Promise<ScheduleEvent> {
    const envelope = await this.request(scheduleEventEnvelopeSchema, {
      method: 'get',
      path: `private/v3/clubs/${this.options.clubId}/schedule/integration/events/${encodeURIComponent(eventId)}`,
    });
    if (!envelope) {
      throw new VirtuaGymV3ApiError(
        404,
        `Event ${eventId} was not found in the response`,
      );
    }
    return envelope.data;
  }

  /**
   * Retrieves every event's bookings in the date range across all pages.
   */
  public async allEventBookings(
    options: EventBookingsOptions,
  ): Promise<ScheduleEvent[]> {
    const events: ScheduleEvent[] = [];
    for await (const page of this.eventBookings(options)) {
      events.push(...page);
    }
    return events;
  }

  /**
   * Yields events with their bookings (participants and guests) page by
   * page, fetching each page lazily. The API answers 204 when nothing
   * matches, which ends the iteration.
   */
  public async *eventBookings(
    options: EventBookingsOptions,
  ): AsyncGenerator<ScheduleEvent[], void, undefined> {
    // The bookings endpoint documents a page_size maximum of 100.
    const pageSize = options.pageSize ?? 100;

    for (let page = 1; ; page++) {
      const params = new URLSearchParams();
      params.set('date_start', options.dateStart.toString());
      params.set('date_end', options.dateEnd.toString());
      params.set('page', page.toString());
      params.set('page_size', pageSize.toString());
      if (options.memberId !== undefined) {
        params.set('member_id', options.memberId.toString());
      }
      if (options.originalMemberId !== undefined) {
        params.set('original_member_id', options.originalMemberId.toString());
      }
      if (options.externalId !== undefined) {
        params.set('external_id', options.externalId);
      }
      if (options.email !== undefined) {
        params.set('email', options.email);
      }
      if (options.deleted !== undefined) {
        params.set('deleted', options.deleted.toString());
      }

      const envelope = await this.request(scheduleEventsEnvelopeSchema, {
        method: 'get',
        path: `private/v3/clubs/${this.options.clubId}/schedule/integration/events/bookings`,
        params,
      });
      const events = envelope?.data.events ?? [];
      if (events.length > 0) {
        yield events;
      }
      const totalPages = envelope?.data.total_pages;
      if (events.length === 0 || page >= (totalPages ?? page)) {
        return;
      }
    }
  }

  /**
   * Books a member (member_id/original_member_id) or a guest into a
   * schedule event. Inspect the returned booking attempts' reason codes to
   * see whether the booking was accepted.
   */
  public async createBooking(
    eventId: string,
    data: CreateBookingData,
  ): Promise<BookingCreated> {
    const result = await this.request(bookingCreatedSchema, {
      method: 'post',
      path: `private/v3/clubs/${this.options.clubId}/schedule/integration/events/${encodeURIComponent(eventId)}/bookings`,
      data,
    });
    return result ?? { bookings: [] };
  }

  /**
   * Updates an existing booking (e.g. presence) for a member or guest.
   *
   * Throws {@link VirtuaGymV3ApiError} (httpStatus 404) when the booking
   * does not exist.
   */
  public async updateBooking(
    eventId: string,
    data: UpdateBookingData,
  ): Promise<void> {
    await this.request(z.unknown(), {
      method: 'put',
      path: `private/v3/clubs/${this.options.clubId}/schedule/integration/events/${encodeURIComponent(eventId)}/bookings`,
      data,
    });
  }

  /**
   * Cancels a booking for a member or guest.
   *
   * Throws {@link VirtuaGymV3ApiError} (httpStatus 404) when the booking
   * does not exist.
   */
  public async cancelBooking(
    eventId: string,
    options: CancelBookingOptions,
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options.memberId !== undefined) {
      params.set('member_id', options.memberId.toString());
    }
    if (options.originalMemberId !== undefined) {
      params.set('original_member_id', options.originalMemberId.toString());
    }
    if (options.externalId !== undefined) {
      params.set('external_id', options.externalId);
    }
    if (options.guestEmail !== undefined) {
      params.set('guest_email', options.guestEmail);
    }
    if (options.refund !== undefined) {
      params.set('refund', options.refund.toString());
    }
    if (options.freeCancellationRange !== undefined) {
      params.set(
        'free_cancellation_range',
        options.freeCancellationRange.toString(),
      );
    }
    if (options.cancellationRange !== undefined) {
      params.set('cancellation_range', options.cancellationRange.toString());
    }

    await this.request(z.unknown(), {
      method: 'delete',
      path: `private/v3/clubs/${this.options.clubId}/schedule/integration/events/${encodeURIComponent(eventId)}/bookings`,
      params,
    });
  }

  private async mutateLead(
    config: Pick<IRequestConfig, 'method' | 'path'>,
    data: UpdateLeadData,
  ): Promise<Lead> {
    const envelope = await this.request(leadMutatedEnvelopeSchema, {
      ...config,
      data,
    });
    if (!envelope) {
      throw new VirtuaGymV3ApiError(
        204,
        'The lead mutation returned an empty response',
      );
    }
    // The mutation response only carries the id (a string on create, a
    // number on update); re-fetch the canonical record.
    return this.lead(envelope.data.id);
  }

  /**
   * Retrieves an access token, reusing the cached one until it expires.
   * Tokens are club-specific (x-represent-club-id) and expire after ~30
   * minutes.
   */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.accessToken;
    }

    let response;
    try {
      response = await this.http.request<unknown>({
        method: 'post',
        url: TOKEN_URL,
        data: new URLSearchParams({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          grant_type: 'client_credentials',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-represent-club-id': this.options.clubId.toString(),
        },
      });
    } catch (error) {
      throw toApiError(error);
    }

    const { access_token, expires_in } = tokenResponseSchema.parse(
      response.data,
    );
    // Renew a minute early so in-flight requests don't race the expiry.
    this.token = {
      accessToken: access_token,
      expiresAt: Date.now() + Math.max(expires_in - 60, 0) * 1000,
    };
    return access_token;
  }

  /**
   * Performs an authenticated request and parses the response body with the
   * given schema. Returns undefined for empty bodies (HTTP 204). On a 401
   * the token is refreshed and the request retried once.
   */
  private async request<T>(
    bodySchema: z.ZodType<T>,
    config: IRequestConfig,
    retryOnUnauthorized = true,
  ): Promise<T | undefined> {
    const accessToken = await this.accessToken();
    const query = config.params?.toString();
    const url = `${GATEWAY_URL}/${config.path}${query ? `?${query}` : ''}`;

    let response;
    try {
      response = await this.http.request<unknown>({
        method: config.method,
        url,
        data: config.data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      if (
        retryOnUnauthorized &&
        axios.isAxiosError(error) &&
        error.response?.status === 401
      ) {
        this.token = undefined;
        return this.request(bodySchema, config, false);
      }
      throw toApiError(error);
    }

    if (
      response.status === 204 ||
      response.data === '' ||
      response.data === undefined ||
      response.data === null
    ) {
      return undefined;
    }
    return bodySchema.parse(response.data);
  }
}

/** Extracts the message from the three error shapes the v3 stack uses. */
function toApiError(error: unknown): unknown {
  if (!axios.isAxiosError(error) || !error.response) {
    return error;
  }
  const status = error.response.status;
  const data: unknown = error.response.data;

  // Leads endpoints: {status: "fail", error: {status, message}}.
  const nested = z
    .object({ error: z.object({ message: z.string() }) })
    .safeParse(data);
  if (nested.success) {
    return new VirtuaGymV3ApiError(status, nested.data.error.message);
  }

  // Schedule endpoints: {message, fields?, status}.
  const flat = z
    .object({
      message: z.string(),
      fields: z.array(z.string()).optional(),
    })
    .safeParse(data);
  if (flat.success) {
    return new VirtuaGymV3ApiError(status, flat.data.message, flat.data.fields);
  }

  // Token endpoint (Keycloak): {error, error_description?}.
  const oauth = z
    .object({
      error: z.string(),
      error_description: z.string().optional(),
    })
    .safeParse(data);
  if (oauth.success) {
    return new VirtuaGymV3ApiError(
      status,
      oauth.data.error_description ?? oauth.data.error,
    );
  }

  return error;
}

export interface LeadsOptions {
  /**
   * Leads per page. Undocumented but verified live (the documented
   * page_size parameter is ignored; the server default is 25).
   */
  readonly limit?: number;
}

/**
 * Fields accepted when creating or updating a lead. Names match the API's
 * wire format.
 */
export interface LeadMutationData {
  /** At least one of email, phone or mobile is required by the API. */
  readonly email?: string;
  readonly phone?: string;
  readonly mobile?: string;
  /** 'f' = female, 'm' = male. */
  readonly gender?: 'm' | 'f';
  /** The birthday of the lead (YYYY-MM-DD). */
  readonly birthday?: string;
  readonly address?: string;
  readonly address_2?: string;
  readonly zip_code?: string;
  readonly city?: string;
  readonly state?: string;
  readonly country?: string;
  readonly formatted_address?: string;
  /** Two-letter language code. */
  readonly language?: string;
  /** The API defaults to 1 (New). */
  readonly status_id?: LeadStatusId;
  /** Lead source id. */
  readonly source?: number;
  readonly note?: string;
  /** Member id of the staff member who owns the lead. */
  readonly owner_id?: number;
  /** ID from the external system. */
  readonly external_id?: string;
  /** The API defaults to the current date (YYYY-MM-DD). */
  readonly lead_since?: string;
  /** 0 = not deleted, 1 = deleted. */
  readonly deleted?: 0 | 1;
}

export interface CreateLeadData extends LeadMutationData {
  readonly firstname: string;
  readonly lastname: string;
}

export interface UpdateLeadData extends LeadMutationData {
  readonly firstname?: string;
  readonly lastname?: string;
}

export type ScheduleEventType =
  'appointment' | 'group_class' | 'staff_only' | 'other';

export interface ScheduleEventsOptions {
  /** Start of the date range, UTC milliseconds (inclusive). */
  readonly dateStart: number;
  /** End of the date range, UTC milliseconds (inclusive, >= dateStart). */
  readonly dateEnd: number;
  /** Events per page. Defaults to 100. */
  readonly pageSize?: number;
  /** Include deleted events. The API defaults to false. */
  readonly deleted?: boolean;
  /** Filter by event type; omitted = all types. */
  readonly eventType?: ScheduleEventType;
}

/**
 * Options for listing bookings. The participant filters (memberId,
 * originalMemberId, externalId, email) are mutually exclusive.
 */
export type EventBookingsOptions = {
  /** Start of the date range, UTC milliseconds (inclusive). */
  readonly dateStart: number;
  /** End of the date range, UTC milliseconds (inclusive, >= dateStart). */
  readonly dateEnd: number;
  /** Events per page (max 100, the default). */
  readonly pageSize?: number;
  /** Filter by soft-deleted status of participants/guests. */
  readonly deleted?: boolean;
} & (
  | {
      readonly memberId?: never;
      readonly originalMemberId?: never;
      readonly externalId?: never;
      readonly email?: never;
    }
  | {
      /** Filter by participant member_id. */
      readonly memberId: number;
      readonly originalMemberId?: never;
      readonly externalId?: never;
      readonly email?: never;
    }
  | {
      /** Filter by participant original_member_id (superclubs). */
      readonly originalMemberId: number;
      readonly memberId?: never;
      readonly externalId?: never;
      readonly email?: never;
    }
  | {
      /** Filter by guest external_id. */
      readonly externalId: string;
      readonly memberId?: never;
      readonly originalMemberId?: never;
      readonly email?: never;
    }
  | {
      /** Filter by guest email. */
      readonly email: string;
      readonly memberId?: never;
      readonly originalMemberId?: never;
      readonly externalId?: never;
    }
);

/** Per-request overrides of the activity's booking rules. */
export interface BookingRuleOverrides {
  readonly bookable_till_range?: boolean;
  readonly booking_closes_range?: boolean;
  readonly min_time_between_bookings_range?: boolean;
  readonly penalty_booking?: boolean;
}

/** A guest to book into an event. Names match the API's wire format. */
export interface BookingGuestData {
  readonly first_name?: string;
  readonly last_name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly presence?: boolean;
  readonly follow_up_as_lead?: boolean;
  /** Guest external ID (mutually exclusive with email when updating). */
  readonly external_id?: string;
}

/**
 * Body for creating a booking. Exactly one of member_id,
 * original_member_id or guest identifies who is booked. Names match the
 * API's wire format.
 */
export type CreateBookingData = {
  readonly presence?: boolean;
  readonly apply_booking_rules?: BookingRuleOverrides;
} & (
  | {
      readonly member_id: number;
      readonly original_member_id?: never;
      readonly guest?: never;
    }
  | {
      readonly original_member_id: number;
      readonly member_id?: never;
      readonly guest?: never;
    }
  | {
      readonly guest: BookingGuestData;
      readonly member_id?: never;
      readonly original_member_id?: never;
    }
);

/**
 * Body for updating a booking. Exactly one of member_id,
 * original_member_id or guest identifies the booking; guests are matched on
 * email or external_id. Names match the API's wire format.
 */
export type UpdateBookingData =
  | {
      readonly member_id: number;
      readonly presence?: boolean;
      readonly original_member_id?: never;
      readonly guest?: never;
    }
  | {
      readonly original_member_id: number;
      readonly presence?: boolean;
      readonly member_id?: never;
      readonly guest?: never;
    }
  | {
      readonly guest: BookingGuestData;
      readonly member_id?: never;
      readonly original_member_id?: never;
      readonly presence?: never;
    };

/**
 * Options for cancelling a booking. Exactly one of memberId,
 * originalMemberId, externalId or guestEmail identifies the booking.
 */
export type CancelBookingOptions = {
  /**
   * Whether to refund credits (leading rule). The API defaults to true;
   * false never refunds.
   */
  readonly refund?: boolean;
  /** Apply the free-cancellation window rule. The API defaults to true. */
  readonly freeCancellationRange?: boolean;
  /** Apply the regular cancellation window rule. The API defaults to true. */
  readonly cancellationRange?: boolean;
} & (
  | {
      readonly memberId: number;
      readonly originalMemberId?: never;
      readonly externalId?: never;
      readonly guestEmail?: never;
    }
  | {
      readonly originalMemberId: number;
      readonly memberId?: never;
      readonly externalId?: never;
      readonly guestEmail?: never;
    }
  | {
      readonly externalId: string;
      readonly memberId?: never;
      readonly originalMemberId?: never;
      readonly guestEmail?: never;
    }
  | {
      readonly guestEmail: string;
      readonly memberId?: never;
      readonly originalMemberId?: never;
      readonly externalId?: never;
    }
);

interface IRequestConfig {
  method: 'get' | 'put' | 'post' | 'delete';
  path: string;
  params?: URLSearchParams;
  data?: unknown;
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  /** Lifetime in seconds (1800 live). */
  expires_in: z.number(),
});

// Leads endpoints wrap their payload in {status, message?, data}.
const leadsEnvelopeSchema = z.object({
  status: z.string(),
  data: z.object({
    leads: z.array(leadSchema),
    // Undocumented extras observed live:
    has_leads: z.boolean().optional(),
    // A map owner_id → staff member, but an empty ARRAY when a page has no
    // owners (PHP serialization of an empty associative array).
    owners: z
      .union([z.record(z.string(), leadOwnerSchema), z.array(z.unknown())])
      .optional(),
  }),
});

const leadEnvelopeSchema = z.object({
  status: z.string(),
  data: z.object({ lead: leadSchema }),
});

const leadMutatedEnvelopeSchema = z.object({
  status: z.string(),
  data: z.object({
    status: z.string(),
    message: z.string().optional(),
    // A string on create ("1234"), a number on update (2274).
    id: z.union([z.string(), z.number()]),
  }),
});

// Schedule endpoints wrap their payload in {status, status_code, data}.
const scheduleEventsEnvelopeSchema = z.object({
  status: z.string().optional(),
  status_code: z.number().optional(),
  data: z.object({
    events: z.array(scheduleEventSchema).optional(),
    total_pages: z.number().optional(),
  }),
});

const scheduleEventEnvelopeSchema = z.object({
  status: z.string().optional(),
  status_code: z.number().optional(),
  data: scheduleEventSchema,
});
