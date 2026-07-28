import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import { clubEventSchema, type ClubEvent } from '../models/club-event';
import {
  employeeSchema,
  type Employee,
  type EmployeePrivilege,
} from '../models/employee';
import { memberSchema, type Member } from '../models/member';
import type { VirtuaGymClientV1Options } from './virtuagym-client-v1-options';

/** An error reported by the Virtuagym API itself (which can arrive with HTTP 200). */
export class VirtuaGymApiError extends Error {
  constructor(
    public readonly statuscode: number,
    public readonly statusmessage: string,
    /** Validation error details, when the endpoint provides them. */
    public readonly errors?: unknown,
  ) {
    super(`Virtuagym API error ${statuscode}: ${statusmessage}`);
    this.name = 'VirtuaGymApiError';
  }
}

export class VirtuaGymClientV1 {
  private readonly http: AxiosInstance;

  constructor(private readonly options: VirtuaGymClientV1Options) {
    this.http = axios.create();
  }

  /** Retrieves every employee across all pages. */
  public async allEmployees(
    options: EmployeesOptions = {},
  ): Promise<Employee[]> {
    const employees: Employee[] = [];
    for await (const page of this.employees(options)) {
      employees.push(...page);
    }
    return employees;
  }

  /**
   * Retrieves a single employee by member ID.
   *
   * Throws {@link VirtuaGymApiError} (statuscode 420) when the employee does
   * not exist or does not belong to the club.
   */
  public async employee(
    memberId: number,
    options: EmployeeOptions = {},
  ): Promise<Employee> {
    const params = new URLSearchParams();
    if (options.anySubClub) {
      params.set('any_sub_club', '1');
    }
    if (options.with) {
      params.set('with', options.with);
    }

    // The API returns the single employee as a one-element result array.
    const { result } = await this.request(z.array(employeeSchema), {
      method: 'get',
      path: `club/${this.options.clubId}/employee/${memberId}`,
      contentType: 'application/json',
      params,
    });

    const employee = result[0];
    if (!employee) {
      throw new VirtuaGymApiError(
        420,
        `Employee ${memberId} was not found in the response`,
      );
    }
    return employee;
  }

  /**
   * Creates a new employee. Depending on the club settings, Virtuagym sends
   * an e-mail invite to the given address.
   */
  public createEmployee(data: CreateEmployeeData): Promise<Employee> {
    return this.mutateEmployee(`club/${this.options.clubId}/employee`, data);
  }

  /**
   * Updates an existing employee.
   *
   * Throws {@link VirtuaGymApiError} (statuscode 420) when the employee does
   * not exist or does not belong to the club.
   */
  public updateEmployee(
    memberId: number,
    data: UpdateEmployeeData,
  ): Promise<Employee> {
    return this.mutateEmployee(
      `club/${this.options.clubId}/employee/${memberId}`,
      data,
    );
  }

  /**
   * Creates a new employee, or updates the existing employee with the same
   * external_id. Throws {@link VirtuaGymApiError} (statuscode 420) when
   * multiple members in the club share the external_id.
   */
  public createOrUpdateEmployee(
    data: CreateOrUpdateEmployeeData,
  ): Promise<Employee> {
    return this.mutateEmployee(
      `club/${this.options.clubId}/employee/create_or_update`,
      data,
    );
  }

  /**
   * Yields employees page by page, fetching each page lazily — the next
   * request is only made when the consumer asks for the next page.
   */
  public async *employees(
    options: EmployeesOptions = {},
  ): AsyncGenerator<Employee[], void, undefined> {
    // Incremental sync: only employees edited on/after this timestamp (ms) are
    // returned. Defaults to 0 (full fetch).
    let syncFrom = options.syncFrom ?? 0;
    let fromId: number | undefined;

    for (;;) {
      const params = new URLSearchParams();
      //club_member_id (optional), with (optional), any_sub_club (optional), rfid_tag (optional)
      params.set('sync_from', syncFrom.toString());
      if (fromId !== undefined) {
        params.set('from_id', fromId.toString());
      }
      if (options.clubMemberId) {
        params.set('club_member_id', options.clubMemberId.toString());
      }
      if (options.rfidTag) {
        params.set('rfid_tag', options.rfidTag);
      }
      if (options.anySubClub) {
        params.set('any_sub_club', '1');
      }
      if (options.with) {
        params.set('with', options.with);
      }

      const { result, status } = await this.request(z.array(employeeSchema), {
        method: 'get',
        path: `club/${this.options.clubId}/employee`,
        contentType: 'application/json',
        params,
      });
      if (result.length > 0) {
        yield result;
      }

      const last = result[result.length - 1];
      if ((status.results_remaining ?? 0) <= 0 || !last) {
        return;
      }
      const next = parseNextPage(status.next_page);
      if (next) {
        syncFrom = next.syncFrom ?? syncFrom;
        fromId = next.fromId;
      } else {
        syncFrom = last.timestamp_edit;
        fromId = last.member_id;
      }
    }
  }

  /** Retrieves every club event matching the query across all pages. */
  public async allEvents(
    options: ClubEventsOptions = {},
  ): Promise<ClubEvent[]> {
    const events: ClubEvent[] = [];
    for await (const page of this.events(options)) {
      events.push(...page);
    }
    return events;
  }

  /**
   * Yields club events page by page, fetching each page lazily.
   *
   * Unlike employees, the events endpoint documents no per-item pagination
   * cursor; when the API reports results remaining, the next page is
   * requested with sync_from advanced to the previous response's status
   * timestamp (Virtuagym's general sync mechanism).
   */
  public async *events(
    options: ClubEventsOptions = {},
  ): AsyncGenerator<ClubEvent[], void, undefined> {
    let syncFrom = options.syncFrom ?? 0;

    for (;;) {
      const params = new URLSearchParams();
      params.set('sync_from', syncFrom.toString());
      if (options.timestampStart !== undefined) {
        params.set('timestamp_start', options.timestampStart.toString());
      }
      if (options.timestampEnd !== undefined) {
        params.set('timestamp_end', options.timestampEnd.toString());
      }
      if (options.memberId !== undefined) {
        params.set('member_id', options.memberId.toString());
      }
      if (options.scheduleId !== undefined) {
        params.set('schedule_id', options.scheduleId.toString());
      }

      const { result, status } = await this.request(z.array(clubEventSchema), {
        method: 'get',
        path: `club/${this.options.clubId}/events`,
        contentType: 'application/json',
        params,
      });
      if (result.length > 0) {
        yield result;
      }

      if ((status.results_remaining ?? 0) <= 0 || result.length === 0) {
        return;
      }
      const next = parseNextPage(status.next_page);
      if (next?.syncFrom !== undefined) {
        syncFrom = next.syncFrom;
      } else if (status.timestamp > syncFrom) {
        // Guard against looping forever if the cursor cannot advance.
        syncFrom = status.timestamp;
      } else {
        return;
      }
    }
  }

  /**
   * Retrieves a single club event by event ID.
   *
   * Throws {@link VirtuaGymApiError} (statuscode 420) when the event does
   * not exist.
   */
  public async event(
    eventId: string,
    options: ClubEventOptions = {},
  ): Promise<ClubEvent> {
    const params = new URLSearchParams();
    params.set('sync_from', (options.syncFrom ?? 0).toString());

    // The API is inconsistent about single results (object vs one-element
    // array), so accept both.
    const { result } = await this.request(
      z.union([z.array(clubEventSchema), clubEventSchema]),
      {
        method: 'get',
        path: `club/${this.options.clubId}/events/${encodeURIComponent(eventId)}`,
        contentType: 'application/json',
        params,
      },
    );

    const event = Array.isArray(result) ? result[0] : result;
    if (!event) {
      throw new VirtuaGymApiError(
        420,
        `Event ${eventId} was not found in the response`,
      );
    }
    return event;
  }

  /** Retrieves every member across all pages. */
  public async allMembers(options: MembersOptions = {}): Promise<Member[]> {
    const members: Member[] = [];
    for await (const page of this.members(options)) {
      members.push(...page);
    }
    return members;
  }

  /**
   * Yields members page by page, fetching each page lazily — the next
   * request is only made when the consumer asks for the next page.
   */
  public async *members(
    options: MembersOptions = {},
  ): AsyncGenerator<Member[], void, undefined> {
    // Incremental sync: only members edited on/after this timestamp (ms) are
    // returned. Defaults to 0 (full fetch).
    let syncFrom = options.syncFrom ?? 0;
    let fromId: number | undefined;

    for (;;) {
      const params = new URLSearchParams();
      params.set('sync_from', syncFrom.toString());
      if (fromId !== undefined) {
        params.set('from_id', fromId.toString());
      }
      if (options.clubMemberId) {
        params.set('club_member_id', options.clubMemberId.toString());
      }
      if (options.rfidTag) {
        params.set('rfid_tag', options.rfidTag);
      }
      if (options.externalId) {
        params.set('external_id', options.externalId);
      }
      if (options.email) {
        params.set('email', options.email);
      }
      if (options.anySubClub) {
        params.set('any_sub_club', '1');
      }
      if (options.with) {
        params.set('with', options.with);
      }

      const { result, status } = await this.request(z.array(memberSchema), {
        method: 'get',
        path: `club/${this.options.clubId}/member`,
        contentType: 'application/json',
        params,
      });
      if (result.length > 0) {
        yield result;
      }

      const last = result[result.length - 1];
      if ((status.results_remaining ?? 0) <= 0 || !last) {
        return;
      }
      const next = parseNextPage(status.next_page);
      if (next) {
        syncFrom = next.syncFrom ?? syncFrom;
        fromId = next.fromId;
      } else {
        syncFrom = last.timestamp_edit;
        fromId = last.member_id;
      }
    }
  }

  /**
   * Retrieves a single member by member ID.
   *
   * Throws {@link VirtuaGymApiError} (statuscode 420) when the member does
   * not exist or does not belong to the club.
   */
  public async member(
    memberId: number,
    options: MemberOptions = {},
  ): Promise<Member> {
    const params = new URLSearchParams();
    if (options.anySubClub) {
      params.set('any_sub_club', '1');
    }
    if (options.with) {
      params.set('with', options.with);
    }

    // The API returns the single member as a one-element result array.
    const { result } = await this.request(z.array(memberSchema), {
      method: 'get',
      path: `club/${this.options.clubId}/member/${memberId}`,
      contentType: 'application/json',
      params,
    });

    const member = result[0];
    if (!member) {
      throw new VirtuaGymApiError(
        420,
        `Member ${memberId} was not found in the response`,
      );
    }
    return member;
  }

  /**
   * Creates a new member. Depending on the club settings, Virtuagym sends an
   * e-mail invite to the given address.
   */
  public createMember(data: CreateMemberData): Promise<Member> {
    return this.mutateMember(`club/${this.options.clubId}/member`, data);
  }

  /**
   * Updates an existing member.
   *
   * Throws {@link VirtuaGymApiError} (statuscode 420) when the member does
   * not exist or does not belong to the club.
   */
  public updateMember(
    memberId: number,
    data: UpdateMemberData,
  ): Promise<Member> {
    return this.mutateMember(
      `club/${this.options.clubId}/member/${memberId}`,
      data,
    );
  }

  /**
   * Creates a new member, or updates the existing member with the same
   * external_id. Also transfers a member to another sub-club when
   * club_external_id targets a different sub-club (the client must then be
   * configured with the super club's id and secret).
   */
  public createOrUpdateMember(data: CreateOrUpdateMemberData): Promise<Member> {
    return this.mutateMember(
      `club/${this.options.clubId}/member/create_or_update`,
      data,
    );
  }

  /**
   * Activates the user profile for a club's member, or connects the member
   * to an existing user profile (connect_to_existing).
   *
   * Validation failures throw {@link VirtuaGymApiError} with the endpoint's
   * error details in `errors`.
   */
  public async activateUser(
    data: ActivateUserData,
  ): Promise<ActivateUserResult> {
    const { result } = await this.request(activateUserResultSchema, {
      method: 'post',
      path: `club/${this.options.clubId}/member/activate_user`,
      contentType: 'application/json',
      data,
    });
    return result;
  }

  private async mutateMember(
    path: string,
    data: UpdateMemberData,
  ): Promise<Member> {
    const { result } = await this.request(memberMutationResultSchema, {
      method: 'put',
      path,
      contentType: 'application/json',
      data,
    });
    // PUT responses are inconsistent (booleans as 0/1, timestamps as date
    // strings, missing fields), so re-fetch the canonical record.
    try {
      return await this.member(result.member_id);
    } catch (error) {
      // After a sub-club transfer the member no longer belongs to this club
      // id; retry across the chain (works when configured with the super
      // club's secret, as a transfer requires anyway).
      if (error instanceof VirtuaGymApiError) {
        return this.member(result.member_id, { anySubClub: true });
      }
      throw error;
    }
  }

  private async mutateEmployee(
    path: string,
    data: UpdateEmployeeData,
  ): Promise<Employee> {
    const { result } = await this.request(mutationResultSchema, {
      method: 'put',
      path,
      contentType: 'application/json',
      data,
    });
    // PUT responses are inconsistent across endpoints (booleans as 0/1,
    // timestamps as date strings, missing fields), so re-fetch the canonical
    // record instead of trusting the mutation payload.
    return this.employee(result.member_id);
  }

  private async request<T>(
    resultSchema: z.ZodType<T>,
    config: IRequestConfig,
  ): Promise<{ status: VirtuaGymStatus; result: T }> {
    const params = config.params ?? new URLSearchParams();
    params.set('api_key', this.options.apiKey);
    params.set('club_secret', this.options.clubSecret);
    const query = params.toString();
    const url = `https://api.virtuagym.com/api/v1/${config.path}?${query}`;
    const response = await this.http.request<unknown>({
      method: config.method,
      url,
      data: config.data,
      headers: {
        ...(config.contentType ? { 'Content-Type': config.contentType } : {}),
      },
    });

    // Errors are reported in-band: a flat `{statuscode, statusmessage, ...}`
    // body (no `result`), delivered with HTTP 200 — axios does not throw.
    // Errors are reported in-band with HTTP 200, in two shapes: flat
    // ({statuscode, ...}) or nested ({status: {...}, errors?}) without a
    // result. Success is any 2xx statuscode (create_or_update returns 201).
    const flatError = flatErrorSchema.safeParse(response.data);
    if (flatError.success && !isSuccessCode(flatError.data.statuscode)) {
      throw new VirtuaGymApiError(
        flatError.data.statuscode,
        flatError.data.statusmessage,
        flatError.data.errors,
      );
    }

    const nested = nestedStatusSchema.safeParse(response.data);
    if (nested.success && !isSuccessCode(nested.data.status.statuscode)) {
      throw new VirtuaGymApiError(
        nested.data.status.statuscode,
        nested.data.status.statusmessage,
        nested.data.errors,
      );
    }

    return z
      .object({ status: statusSchema, result: resultSchema })
      .parse(response.data);
  }
}

function isSuccessCode(statuscode: number): boolean {
  return statuscode >= 200 && statuscode < 300;
}

export interface EmployeeOptions {
  /**
   * Also search the other sub-clubs of the chain. Requires the club_secret of
   * the super club.
   */
  readonly anySubClub?: boolean;
  /**
   * Passed through as the `with` URL parameter. The API does not document its
   * values.
   */
  readonly with?: string;
}

export interface EmployeesOptions extends EmployeeOptions {
  /** Filter on the custom ID from the external system ("Own member ID"). */
  readonly clubMemberId?: number;
  /** Only return employees edited on/after this timestamp (ms). Defaults to 0 (full fetch). */
  readonly syncFrom?: number;
  /** Filter on the Rf-ID tag that is tied to the employee. */
  readonly rfidTag?: string;
}

export interface ClubEventOptions {
  /** Only consider events edited on/after this timestamp (ms). Defaults to 0. */
  readonly syncFrom?: number;
}

export interface ClubEventsOptions extends ClubEventOptions {
  /** Start of the event time range (timestamp in seconds). */
  readonly timestampStart?: number;
  /** End of the event time range (timestamp in seconds). */
  readonly timestampEnd?: number;
  /** Only events booked by this member. */
  readonly memberId?: number;
  /** Only events belonging to this schedule. */
  readonly scheduleId?: number;
}

export interface MemberOptions {
  /**
   * Also search the other sub-clubs of the chain. Requires the club_secret of
   * the super club.
   */
  readonly anySubClub?: boolean;
  /** Embed membership instances in the result. */
  readonly with?: 'memberships' | 'active_memberships';
}

export interface MembersOptions extends MemberOptions {
  /** Filter on the custom ID from the external system ("Own member ID"). */
  readonly clubMemberId?: number;
  /** Only return members edited on/after this timestamp (ms). Defaults to 0 (full fetch). */
  readonly syncFrom?: number;
  /** Filter on the Rf-ID tag that is tied to the member. */
  readonly rfidTag?: string;
  /** Filter on the ID from the external system. */
  readonly externalId?: string;
  /** Filter on the member's email address. */
  readonly email?: string;
}

/** Fields shared by all member mutations. Names match the API's wire format. */
export interface MemberMutationData {
  /** An invitation may be sent to this address when the member is created. */
  readonly email?: string;
  /** ID for the member from the external system. */
  readonly external_id?: string;
  /** External ID of a sub-club; used to transfer the member to that sub-club. */
  readonly club_external_id?: string;
  readonly active?: boolean;
  readonly gender?: 'm' | 'f';
  /** The birthday of the member (YYYY-MM-DD). */
  readonly birthday?: string;
  /** The language the member uses in the portal (e.g. 'en', 'nl'). */
  readonly lang?: string;
  readonly zip?: string;
  readonly street?: string;
  readonly street_extra?: string;
  readonly place?: string;
  /** The country code where the member lives. */
  readonly country?: string;
  readonly formatted_address?: string;
  readonly phone?: string;
  readonly mobile?: string;
  /** The bank account holder name. */
  readonly ba_owner?: string;
  /** The bank account number. */
  readonly ba_number?: string;
  /** The BIC code of the bank account. */
  readonly ba_bic_code?: string;
  /** The name of the bank. */
  readonly ba_place?: string;
  /** Changes the member's pro status according to pro_start/pro_end. */
  readonly is_pro?: boolean;
  /** Timestamp of pro activation. Only used with is_pro = true. */
  readonly pro_start?: number;
  /** Timestamp of pro deactivation. Requires is_pro to be sent. */
  readonly pro_end?: number;
  /** The future inactive date (YYYY-MM-DD); remove by setting "0000-00-00". */
  readonly unsubscribe_date?: string;
  readonly early_booking_access?: boolean;
  /** 0 Novice, 1 Beginner, 2 Intermediate, 3 Advanced, 4 Expert. */
  readonly level_id?: 0 | 1 | 2 | 3 | 4;
  /**
   * 1 Lose Weight, 2 Build Muscle, 3 Improve well-being, 4 Improve
   * Performance, 5 Rehabilitation, 6 Get Fit, 7 Shape and Tone (defaults;
   * clubs can rename them).
   */
  readonly goal_id?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Whether the member filled the mandatory intake questionnaire: 1 yes, 0 no. */
  readonly filled_intake_questionnaire?: 0 | 1;
}

export interface CreateMemberData extends MemberMutationData {
  readonly firstname: string;
  readonly lastname: string;
}

export interface UpdateMemberData extends MemberMutationData {
  readonly firstname?: string;
  readonly lastname?: string;
}

export interface CreateOrUpdateMemberData extends UpdateMemberData {
  /** Members are matched on this ID; mandatory for create_or_update. */
  readonly external_id: string;
}

/** Search criteria for activate_user. Multiple criteria combine as AND. */
export interface MemberIdentifier {
  readonly type:
    | 'member_id'
    | 'external_id'
    | 'club_member_id'
    | 'rfid_tag'
    | 'email'
    | 'birthday';
  readonly value: string | number;
}

export interface ActivateUserData {
  /** The email for the user account, independent of the member's email. */
  readonly email: string;
  /** Password for a new user. Not used when connect_to_existing is true. */
  readonly password?: string;
  readonly member_identifier: MemberIdentifier | readonly MemberIdentifier[];
  /** Required (true) to connect the member to an existing user account. */
  readonly connect_to_existing?: boolean;
  readonly ip_address?: string;
  /** IANA timezone name; the API defaults to "Europe/Amsterdam". */
  readonly timezone?: string;
}

export interface ActivateUserResult {
  readonly member_id: number;
  readonly user_id: number;
  readonly club_id: number;
}

/** Fields shared by all employee mutations. Names match the API's wire format. */
export interface EmployeeMutationData {
  /** An invitation is sent to this address when the employee is created. */
  readonly email?: string;
  /** ID from the external system. */
  readonly external_id?: string;
  readonly active?: boolean;
  readonly gender?: 'm' | 'f';
  /** The birthday of the employee (YYYY-MM-DD). */
  readonly birthday?: string;
  /** The language the employee uses in the portal (e.g. 'en', 'nl'). */
  readonly lang?: string;
  readonly zip?: string;
  readonly street?: string;
  readonly street_extra?: string;
  readonly place?: string;
  /** The country code where the employee lives. */
  readonly country?: string;
  readonly formatted_address?: string;
  readonly phone?: string;
  readonly mobile?: string;
  /** The bank account holder name. */
  readonly ba_owner?: string;
  /** The bank account number. */
  readonly ba_number?: string;
  /** The BIC code of the bank account. */
  readonly ba_bic_code?: string;
  readonly is_pro?: boolean;
  /** Timestamp of pro activation. Mandatory when is_pro is true. */
  readonly pro_start?: number;
  /** Timestamp of pro deactivation. Mandatory when is_pro is false. */
  readonly pro_end?: number;
  /** The future inactive date of the employee (YYYY-MM-DD). */
  readonly unsubscribe_date?: string;
  readonly add_priviliges?: readonly EmployeePrivilege[];
}

export interface CreateEmployeeData extends EmployeeMutationData {
  readonly firstname: string;
  readonly lastname: string;
}

export interface UpdateEmployeeData extends EmployeeMutationData {
  readonly firstname?: string;
  readonly lastname?: string;
  /** Only possible when updating. */
  readonly remove_priviliges?: readonly EmployeePrivilege[];
}

export interface CreateOrUpdateEmployeeData extends UpdateEmployeeData {
  /** Employees are matched on this ID; mandatory for create_or_update. */
  readonly external_id: string;
}

interface IRequestConfig {
  method: 'get' | 'put' | 'post';
  path: string;
  params?: URLSearchParams;
  data?: unknown;
  contentType?: string;
}

// Mutation responses are only trusted for the member_id; the canonical record
// is re-fetched through the GET endpoint.
const mutationResultSchema = z.looseObject({ member_id: z.number() });

// Every successful Virtuagym response wraps its payload in this envelope.
const statusSchema = z.object({
  statuscode: z.number(),
  statusmessage: z.string(),
  result_count: z.number(),
  timestamp: z.number(),
  // Present on paginated endpoints; absent means there are no further pages.
  results_remaining: z.number().optional(),
  // Undocumented server-computed cursor for the next page, e.g.
  // "sync_from=1784035004986". Preferred over deriving a cursor from the
  // last item, which live testing showed duplicates boundary rows.
  next_page: z.string().optional(),
});

function parseNextPage(
  nextPage: string | undefined,
): { syncFrom?: number; fromId?: number } | undefined {
  if (!nextPage) {
    return undefined;
  }
  const params = new URLSearchParams(nextPage);
  const syncFrom = Number(params.get('sync_from') ?? NaN);
  const fromId = Number(params.get('from_id') ?? NaN);
  const parsed = {
    ...(Number.isFinite(syncFrom) ? { syncFrom } : {}),
    ...(Number.isFinite(fromId) ? { fromId } : {}),
  };
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

type VirtuaGymStatus = z.infer<typeof statusSchema>;

const flatErrorSchema = z.object({
  statuscode: z.number(),
  statusmessage: z.string(),
  errors: z.unknown().optional(),
});

const nestedStatusSchema = z.object({
  status: statusSchema,
  errors: z.unknown().optional(),
});

// Mutation responses are only trusted for the member_id; the canonical record
// is re-fetched through the GET endpoint.
const memberMutationResultSchema = z.looseObject({ member_id: z.number() });

const activateUserResultSchema = z.object({
  member_id: z.number(),
  user_id: z.number(),
  club_id: z.number(),
});
