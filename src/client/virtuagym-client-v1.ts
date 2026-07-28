import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  employeeSchema,
  type Employee,
  type EmployeePrivilege,
} from '../models/employee';
import type { VirtuaGymClientV1Options } from './virtuagym-client-v1-options';

/** An error reported by the Virtuagym API itself (which can arrive with HTTP 200). */
export class VirtuaGymApiError extends Error {
  constructor(
    public readonly statuscode: number,
    public readonly statusmessage: string,
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
      syncFrom = last.timestamp_edit;
      fromId = last.member_id;
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
    const flatError = flatErrorSchema.safeParse(response.data);
    if (flatError.success && flatError.data.statuscode !== 200) {
      throw new VirtuaGymApiError(
        flatError.data.statuscode,
        flatError.data.statusmessage,
      );
    }

    const envelope = z
      .object({ status: statusSchema, result: resultSchema })
      .parse(response.data);
    if (envelope.status.statuscode !== 200) {
      throw new VirtuaGymApiError(
        envelope.status.statuscode,
        envelope.status.statusmessage,
      );
    }
    return envelope;
  }
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
  method: 'get' | 'put';
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
});

type VirtuaGymStatus = z.infer<typeof statusSchema>;

const flatErrorSchema = z.object({
  statuscode: z.number(),
  statusmessage: z.string(),
});
