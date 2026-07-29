import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { ClubEvent } from '../models/club-event';
import type { Employee } from '../models/employee';
import type { Member } from '../models/member';
import { VirtuaGymApiError, VirtuaGymClientV1 } from './virtuagym-client-v1';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('axios', () => ({
  default: { create: () => ({ request: requestMock }) },
}));

describe('VirtuaGymClientV1', () => {
  const client = new VirtuaGymClientV1({
    apiKey: 'test-api-key',
    clubSecret: 'test-club-secret',
    clubId: 12345,
  });

  const employee = (member_id: number, timestamp_edit: number): Employee => ({
    member_id,
    club_id: 12345,
    firstname: 'Jane',
    lastname: 'Doe',
    email: 'jane.doe@example.com',
    active: true,
    is_pro: false,
    member_since: 1700000000000,
    timestamp_edit,
  });

  const envelope = (result: unknown, results_remaining = 0) => ({
    data: {
      status: {
        statuscode: 200,
        statusmessage: 'Everything OK',
        result_count: Array.isArray(result) ? result.length : 1,
        timestamp: 1785274537785,
        results_remaining,
      },
      result,
    },
  });

  beforeEach(() => {
    requestMock.mockReset();
  });

  describe('allEmployees', () => {
    const employees: Employee[] = [employee(1, 1785274500000)];

    it('retrieves the employees of the club', async () => {
      requestMock.mockResolvedValue(envelope(employees));

      const result = await client.allEmployees();

      expect(result).toEqual(employees);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith({
        method: 'get',
        url: 'https://api.virtuagym.com/api/v1/club/12345/employee?sync_from=0&api_key=test-api-key&club_secret=test-club-secret',
        data: undefined,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('filters on club_member_id when clubMemberId is given', async () => {
      requestMock.mockResolvedValue(envelope([]));

      await client.allEmployees({ clubMemberId: 42 });

      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee?sync_from=0&club_member_id=42&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('passes rfid_tag, any_sub_club and with when given', async () => {
      requestMock.mockResolvedValue(envelope([]));

      await client.allEmployees({
        rfidTag: 'tag-123',
        anySubClub: true,
        with: 'extra',
      });

      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee?sync_from=0&rfid_tag=tag-123&any_sub_club=1&with=extra&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('starts from the given syncFrom timestamp for incremental sync', async () => {
      requestMock.mockResolvedValue(envelope([]));

      await client.allEmployees({ syncFrom: 1785274510000 });

      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee?sync_from=1785274510000&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('follows pagination until no results remain', async () => {
      const page1 = [employee(1, 1785274500000), employee(2, 1785274510000)];
      const page2 = [employee(3, 1785274520000)];
      requestMock
        .mockResolvedValueOnce(envelope(page1, 1))
        .mockResolvedValueOnce(envelope(page2, 0));

      const result = await client.allEmployees();

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenCalledTimes(2);
      // The second page is requested from the last item of the first page.
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee?sync_from=1785274510000&from_id=2&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('propagates request failures', async () => {
      requestMock.mockRejectedValue(
        new Error('Request failed with status code 401'),
      );

      await expect(client.allEmployees()).rejects.toThrow(
        'Request failed with status code 401',
      );
    });

    it('throws VirtuaGymApiError on an in-band error envelope', async () => {
      // The API reports errors as a flat body with HTTP 200.
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'Not found.',
          result_count: 0,
          timestamp: 1439302743,
        },
      });

      const error = await client.allEmployees().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({
        statuscode: 420,
        message: 'Virtuagym API error 420: Not found.',
      });
    });

    it('rejects a response that does not match the employee schema', async () => {
      requestMock.mockResolvedValue(envelope([{ member_id: 'not-a-number' }]));

      await expect(client.allEmployees()).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('employee', () => {
    it('retrieves a single employee by member id', async () => {
      const jane = employee(7, 1785274500000);
      requestMock.mockResolvedValue(envelope([jane]));

      const result = await client.employee(7);

      expect(result).toEqual(jane);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee/7?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('passes any_sub_club and with when given', async () => {
      requestMock.mockResolvedValue(envelope([employee(7, 1785274500000)]));

      await client.employee(7, { anySubClub: true, with: 'extra' });

      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee/7?any_sub_club=1&with=extra&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('throws VirtuaGymApiError when the employee does not exist', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'Not found.',
          result_count: 0,
          timestamp: 1439302743,
        },
      });

      await expect(client.employee(999)).rejects.toThrow(
        'Virtuagym API error 420: Not found.',
      );
    });

    it('throws VirtuaGymApiError when the result array is empty', async () => {
      requestMock.mockResolvedValue(envelope([]));

      const error = await client.employee(999).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 420 });
    });
  });

  describe('createEmployee', () => {
    it('creates an employee and returns the canonical record', async () => {
      const created = employee(77338, 1785274500000);
      requestMock
        // PUT responses are unreliable; only member_id is used.
        .mockResolvedValueOnce(envelope({ member_id: 77338, active: 1 }))
        .mockResolvedValueOnce(envelope([created]));

      const result = await client.createEmployee({
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane.doe@example.com',
        add_priviliges: ['coach'],
      });

      expect(result).toEqual(created);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'put',
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane.doe@example.com',
            add_priviliges: ['coach'],
          },
        }),
      );
      // The canonical record is re-fetched through the GET endpoint.
      expect(requestMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: 'get',
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee/77338?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('propagates in-band API errors', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'Employee firstname and lastname are required',
          result_count: 0,
          timestamp: 1439302743,
        },
      });

      await expect(
        client.createEmployee({ firstname: '', lastname: '' }),
      ).rejects.toThrow(
        'Virtuagym API error 420: Employee firstname and lastname are required',
      );
    });
  });

  describe('updateEmployee', () => {
    it('updates the employee and returns the canonical record', async () => {
      const updated = employee(77338, 1785274520000);
      requestMock
        .mockResolvedValueOnce(envelope({ member_id: 77338 }))
        .mockResolvedValueOnce(envelope([updated]));

      const result = await client.updateEmployee(77338, {
        gender: 'f',
        remove_priviliges: ['coach'],
      });

      expect(result).toEqual(updated);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'put',
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee/77338?api_key=test-api-key&club_secret=test-club-secret',
          data: { gender: 'f', remove_priviliges: ['coach'] },
        }),
      );
    });

    it('throws VirtuaGymApiError when the employee does not belong to the club', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'Not found.',
          result_count: 0,
          timestamp: 1439302743,
        },
      });

      const error = await client
        .updateEmployee(999, { firstname: 'Jane' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 420 });
    });
  });

  describe('createOrUpdateEmployee', () => {
    it('sends the mutation to create_or_update and returns the canonical record', async () => {
      const upserted = employee(77338, 1785274520000);
      requestMock
        .mockResolvedValueOnce(envelope({ member_id: 77338 }))
        .mockResolvedValueOnce(envelope([upserted]));

      const result = await client.createOrUpdateEmployee({
        external_id: 'employee1101',
        firstname: 'Jane',
        lastname: 'Doe',
      });

      expect(result).toEqual(upserted);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'put',
          url: 'https://api.virtuagym.com/api/v1/club/12345/employee/create_or_update?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            external_id: 'employee1101',
            firstname: 'Jane',
            lastname: 'Doe',
          },
        }),
      );
    });
  });

  describe('employees', () => {
    it('yields employees page by page', async () => {
      const page1 = [employee(1, 1785274500000), employee(2, 1785274510000)];
      const page2 = [employee(3, 1785274520000)];
      requestMock
        .mockResolvedValueOnce(envelope(page1, 1))
        .mockResolvedValueOnce(envelope(page2, 0));

      const pages = [];
      for await (const page of client.employees()) {
        pages.push(page);
      }

      expect(pages).toEqual([page1, page2]);
    });

    it('fetches pages lazily', async () => {
      const page1 = [employee(1, 1785274500000)];
      const page2 = [employee(2, 1785274510000)];
      requestMock
        .mockResolvedValueOnce(envelope(page1, 1))
        .mockResolvedValueOnce(envelope(page2, 0));

      const iterator = client.employees();

      await iterator.next();
      expect(requestMock).toHaveBeenCalledTimes(1);

      await iterator.next();
      expect(requestMock).toHaveBeenCalledTimes(2);
    });

    it('does not yield an empty page for an empty club', async () => {
      requestMock.mockResolvedValue(envelope([]));

      const pages = [];
      for await (const page of client.employees()) {
        pages.push(page);
      }

      expect(pages).toEqual([]);
    });

    it('propagates request failures to the consuming loop', async () => {
      requestMock.mockRejectedValue(
        new Error('Request failed with status code 401'),
      );

      const iterator = client.employees();

      await expect(iterator.next()).rejects.toThrow(
        'Request failed with status code 401',
      );
    });
  });

  const member = (member_id: number, timestamp_edit: number): Member => ({
    member_id,
    club_id: 12345,
    firstname: 'John',
    lastname: 'Doe',
    email: 'john.doe@example.com',
    active: true,
    is_pro: false,
    member_since: 1700000000000,
    timestamp_edit,
  });

  describe('allMembers', () => {
    it('retrieves members with filter options', async () => {
      const members = [member(1, 1785274500000)];
      requestMock.mockResolvedValue(envelope(members));

      const result = await client.allMembers({
        externalId: 'ext-1',
        email: 'john.doe@example.com',
        with: 'memberships',
      });

      expect(result).toEqual(members);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/member?sync_from=0&external_id=ext-1&email=john.doe%40example.com&with=memberships&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('follows pagination until no results remain', async () => {
      const page1 = [member(1, 1785274500000), member(2, 1785274510000)];
      const page2 = [member(3, 1785274520000)];
      requestMock
        .mockResolvedValueOnce(envelope(page1, 50))
        .mockResolvedValueOnce(envelope(page2, 0));

      const result = await client.allMembers();

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/member?sync_from=1785274510000&from_id=2&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('prefers the server-computed next_page cursor over the last item', async () => {
      const page1 = [member(1, 1785274500000)];
      const page2 = [member(2, 1785274510000)];
      requestMock
        .mockResolvedValueOnce({
          data: {
            status: {
              statuscode: 200,
              statusmessage: 'Everything OK',
              result_count: 1,
              timestamp: 1785274537785,
              results_remaining: 1,
              next_page: 'sync_from=1785274999999',
            },
            result: page1,
          },
        })
        .mockResolvedValueOnce(envelope(page2, 0));

      const result = await client.allMembers();

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/member?sync_from=1785274999999&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('accepts a docs-style member_since date string', async () => {
      requestMock.mockResolvedValue(
        envelope([{ ...member(1, 1785274500000), member_since: '2015-01-14' }]),
      );

      const [result] = await client.allMembers();

      expect(result?.member_since).toBe('2015-01-14');
    });
  });

  describe('member', () => {
    it('retrieves a single member with embedded memberships, normalizing 0/1 flags', async () => {
      // The docs show 0/1 flags on embedded memberships; the schema
      // normalizes them to booleans.
      const wireMembership = {
        instance_id: 2720,
        member_id: 7,
        membership_id: 596,
        active: 1,
        cancelled: 0,
        contract_autorenewed: 0,
        completed: 0,
        paused: 0,
        stopped: 0,
        start_date: '2026-01-29',
        contract_start_date: '2026-02-01',
        contract_end_date: '2026-06-09',
        membership_name: 'Bodytec',
      };
      requestMock.mockResolvedValue(
        envelope([
          { ...member(7, 1785274500000), memberships: [wireMembership] },
        ]),
      );

      const result = await client.member(7, { with: 'memberships' });

      expect(result).toEqual({
        ...member(7, 1785274500000),
        memberships: [
          {
            ...wireMembership,
            active: true,
            cancelled: false,
            contract_autorenewed: false,
            completed: false,
            paused: false,
            stopped: false,
          },
        ],
      });
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/member/7?with=memberships&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('throws VirtuaGymApiError when the member does not exist', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'No member found.',
          result_count: 0,
          timestamp: 1439302743,
        },
      });

      await expect(client.member(999)).rejects.toThrow(
        'Virtuagym API error 420: No member found.',
      );
    });
  });

  describe('member mutations', () => {
    it('creates a member and returns the canonical record', async () => {
      const created = member(77338, 1785274500000);
      requestMock
        .mockResolvedValueOnce(envelope({ member_id: 77338, active: 1 }))
        .mockResolvedValueOnce(envelope([created]));

      const result = await client.createMember({
        firstname: 'John',
        lastname: 'Doe',
        email: 'john@example.com',
        level_id: 2,
        goal_id: 4,
        filled_intake_questionnaire: 1,
      });

      expect(result).toEqual(created);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'put',
          url: 'https://api.virtuagym.com/api/v1/club/12345/member?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            firstname: 'John',
            lastname: 'Doe',
            email: 'john@example.com',
            level_id: 2,
            goal_id: 4,
            filled_intake_questionnaire: 1,
          },
        }),
      );
    });

    it('updates a member via its member_id', async () => {
      const updated = member(77338, 1785274520000);
      requestMock
        .mockResolvedValueOnce(envelope({ member_id: 77338 }))
        .mockResolvedValueOnce(envelope([updated]));

      const result = await client.updateMember(77338, { gender: 'f' });

      expect(result).toEqual(updated);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'put',
          url: 'https://api.virtuagym.com/api/v1/club/12345/member/77338?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('accepts the 201 statuscode returned when create_or_update creates', async () => {
      const created = member(77338, 1785274520000);
      requestMock
        .mockResolvedValueOnce({
          data: {
            status: {
              statuscode: 201,
              statusmessage: 'Everything OK',
              result_count: 10,
              timestamp: 1478252652810,
            },
            result: { member_id: 77338 },
          },
        })
        .mockResolvedValueOnce(envelope([created]));

      const result = await client.createOrUpdateMember({
        external_id: '1ABC234567',
        firstname: 'John',
        lastname: 'Doe',
      });

      expect(result).toEqual(created);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/member/create_or_update?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('re-fetches across sub-clubs after a transfer', async () => {
      const transferred = { ...member(12345, 1785274520000), club_id: 106 };
      requestMock
        // create_or_update with club_external_id moved the member.
        .mockResolvedValueOnce(envelope({ member_id: 12345 }))
        // Plain re-fetch fails: member no longer belongs to this club.
        .mockResolvedValueOnce({
          data: {
            statuscode: 420,
            statusmessage: 'No member found.',
            result_count: 0,
            timestamp: 1439302743,
          },
        })
        .mockResolvedValueOnce(envelope([transferred]));

      const result = await client.createOrUpdateMember({
        external_id: 'member_extid123',
        club_external_id: 'externalid_subclub2',
      });

      expect(result).toEqual(transferred);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/member/12345?any_sub_club=1&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  describe('activateUser', () => {
    it('activates a user profile for a member', async () => {
      requestMock.mockResolvedValue(
        envelope({ member_id: 1001, user_id: 101, club_id: 104 }),
      );

      const result = await client.activateUser({
        email: 'user@example.com',
        password: 'secret-password',
        member_identifier: { type: 'member_id', value: 1001 },
      });

      expect(result).toEqual({ member_id: 1001, user_id: 101, club_id: 104 });
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'post',
          url: 'https://api.virtuagym.com/api/v1/club/12345/member/activate_user?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            email: 'user@example.com',
            password: 'secret-password',
            member_identifier: { type: 'member_id', value: 1001 },
          },
        }),
      );
    });

    it('surfaces validation errors from the nested error envelope', async () => {
      // 406 responses carry status + errors but no result.
      requestMock.mockResolvedValue({
        data: {
          status: {
            statuscode: 406,
            statusmessage: 'Invalid request',
            result_count: 0,
            timestamp: 1575366533123,
          },
          errors: [
            { type: 'Password too short' },
            { type: 'No member identifier could be found' },
          ],
        },
      });

      const error = await client
        .activateUser({
          email: 'user@example.com',
          password: 'x',
          member_identifier: { type: 'member_id', value: 1001 },
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({
        statuscode: 406,
        statusmessage: 'Invalid request',
        errors: [
          { type: 'Password too short' },
          { type: 'No member identifier could be found' },
        ],
      });
    });
  });

  const invoice = (guid: string) => ({
    guid,
    id: 1081,
    member_id: 123,
    club_id: 12345,
    name: 'Apple, Pear',
    price: 2.5,
    price_ex_vat: 2.5,
    currency: 'EUR',
    payment_method: 'card',
    paid: false,
    amount_due: 2.5,
    is_concept: false,
    deleted: false,
    timestamp: 1465551775,
    timestamp_edit: 1465551775,
    timestamp_created: 1465551775,
    rows: [
      {
        guid: `${guid}-row-1`,
        product_name: 'Apple',
        product_desc: 'This is an apple',
        product_count: 1,
        price: 1.5,
        price_ex_vat: 1.5,
        vat: 0,
        currency: 'EUR',
        payment_method: 'card',
        deleted: false,
        income_category: 'other',
        position: 1,
        origin: 'api_created',
        timestamp: 1465551775,
        timestamp_edit: 1465551775,
        timestamp_created: 1465551775,
        club_tax_id: 0,
        club_tax_name: 'No tax',
        club_tax_perc: 0,
      },
    ],
  });

  describe('invoices', () => {
    it('pages with the page parameter, tolerating the numeric next_page', async () => {
      requestMock
        .mockResolvedValueOnce({
          data: {
            status: {
              statuscode: 200,
              statusmessage: 'Everything OK',
              result_count: 1,
              timestamp: 1785313445606,
              results_remaining: 1,
              // The invoices endpoint returns next_page as a NUMBER.
              next_page: 2,
              total_pages: 2,
            },
            result: [invoice('invoice-1')],
          },
        })
        .mockResolvedValueOnce(envelope([invoice('invoice-2')], 0));

      const result = await client.allInvoices();

      expect(result.map((i) => i.guid)).toEqual(['invoice-1', 'invoice-2']);
      expect(requestMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/invoices?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
      expect(requestMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/invoices?page=2&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  describe('invoice', () => {
    it('retrieves a single invoice by guid (object result)', async () => {
      const inv = invoice('982cdf0dca599cb31f968c59c8a525a16b84');
      requestMock.mockResolvedValue(envelope(inv));

      const result = await client.invoice(
        '982cdf0dca599cb31f968c59c8a525a16b84',
      );

      expect(result.guid).toBe('982cdf0dca599cb31f968c59c8a525a16b84');
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/invoices/982cdf0dca599cb31f968c59c8a525a16b84?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  describe('createInvoice', () => {
    it('creates an invoice and returns it with rows', async () => {
      requestMock.mockResolvedValue(
        envelope(invoice('8e65a06c-10d1-4056-8523-f03c58cf3ca4')),
      );

      const result = await client.createInvoice({
        member_id: 123,
        payment_method: 'card',
        rows: [
          {
            name: 'Apple',
            desc: 'This is an apple',
            price: 1.5,
            amount: 1,
            tax_id: 0,
          },
        ],
      });

      expect(result.guid).toBe('8e65a06c-10d1-4056-8523-f03c58cf3ca4');
      expect(result.rows).toHaveLength(1);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'post',
          url: 'https://api.virtuagym.com/api/v1/club/12345/invoices?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            member_id: 123,
            payment_method: 'card',
            rows: [
              {
                name: 'Apple',
                desc: 'This is an apple',
                price: 1.5,
                amount: 1,
                tax_id: 0,
              },
            ],
          },
        }),
      );
    });

    it('propagates in-band validation errors', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage:
            'Parameter rows is empty. At least 1 invoice row is mandatory.',
          result_count: 0,
          timestamp: 1465551775882,
        },
      });

      const error = await client
        .createInvoice({ member_id: 123, rows: [] })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 420 });
    });
  });

  describe('incomeCategories', () => {
    it('retrieves income categories, tolerating nulls and numeric ids', async () => {
      requestMock.mockResolvedValue(
        envelope([
          {
            income_category_id: 'a6e7fd822dad5f7e1549c9749cc78a049290',
            income_category_name: 'Memberships',
            name_id: 'memberships',
            default_tax: null,
            default_tax_id: null,
          },
          {
            // Older docs revision shows numeric ids; coerced to string.
            income_category_id: 2,
            income_category_name: 'Personal Training',
            default_tax: 'BTW 21% (21.00%)',
            default_tax_id: 1002,
          },
        ]),
      );

      const result = await client.incomeCategories();

      expect(result).toEqual([
        expect.objectContaining({
          income_category_id: 'a6e7fd822dad5f7e1549c9749cc78a049290',
          default_tax: null,
        }),
        expect.objectContaining({
          income_category_id: '2',
          default_tax_id: 1002,
        }),
      ]);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/income-categories?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  const participant = (
    event_participant_id: number,
    timestamp_edit: number,
  ) => ({
    event_participant_id,
    event_id: '1977058374-54d4cab74fd424-52808265',
    member_id: 1233,
    email_address: 'participant@example.com',
    notes: '',
    present: true,
    absence_reason: '',
    has_paid: true,
    ticket_printed: false,
    timestamp_edit,
  });

  describe('eventParticipants', () => {
    it('retrieves participants with all query parameters', async () => {
      const participants = [participant(49977, 1785274500000)];
      requestMock.mockResolvedValue(envelope(participants));

      const result = await client.allEventParticipants({
        timestampStart: 1535328000,
        timestampEnd: 1535356900,
        eventId: '1977058374-54d4cab74fd424-52808265',
        fillGuestname: true,
      });

      expect(result).toEqual(participants);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/eventparticipants?sync_from=0&timestamp_start=1535328000&timestamp_end=1535356900&event_id=1977058374-54d4cab74fd424-52808265&fill_guestname=1&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('advances the cursor on timestamp_edit while results remain', async () => {
      const page1 = [participant(1, 1785274500000)];
      const page2 = [participant(2, 1785274510000)];
      requestMock
        .mockResolvedValueOnce(envelope(page1, 1))
        .mockResolvedValueOnce(envelope(page2, 0));

      const result = await client.allEventParticipants();

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/eventparticipants?sync_from=1785274500000&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  describe('eventParticipant', () => {
    it('retrieves a single booking by id', async () => {
      const booking = participant(49977, 1785274500000);
      requestMock.mockResolvedValue(envelope([booking]));

      const result = await client.eventParticipant(49977);

      expect(result).toEqual(booking);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/eventparticipants/49977?sync_from=0&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  describe('createEventParticipant', () => {
    it('books a member into an event', async () => {
      requestMock.mockResolvedValue(
        envelope({
          member_id: 12345,
          event_id: '1125559680-54d4cadf992ff6-77810154',
          event_participant_id: 50794,
          message: 'Added member to event',
        }),
      );

      const booking = await client.createEventParticipant({
        event_id: '1125559680-54d4cadf992ff6-77810154',
        member_id: 12345,
        send_email: true,
      });

      expect(booking.event_participant_id).toBe(50794);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'post',
          url: 'https://api.virtuagym.com/api/v1/club/12345/eventparticipants?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            event_id: '1125559680-54d4cadf992ff6-77810154',
            member_id: 12345,
            send_email: true,
          },
        }),
      );
    });

    it('throws VirtuaGymApiError when the class is full', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 430,
          statusmessage:
            'Could not make a reservation for the class. Class is full.',
          result_count: 0,
          timestamp: 1456505217423,
        },
      });

      const error = await client
        .createEventParticipant({ event_id: 'event-1', member_id: 12345 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 430 });
    });
  });

  describe('updateEventParticipant', () => {
    it('marks the ticket as printed', async () => {
      requestMock.mockResolvedValue(
        envelope({ message: 'ticket_printed now set to true' }),
      );

      await client.updateEventParticipant(50797, { ticket_printed: true });

      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'put',
          url: 'https://api.virtuagym.com/api/v1/club/12345/eventparticipants?api_key=test-api-key&club_secret=test-club-secret',
          data: { event_participant_id: 50797, ticket_printed: true },
        }),
      );
    });
  });

  describe('deleteEventParticipant', () => {
    it('cancels the booking', async () => {
      requestMock.mockResolvedValue(
        envelope({ message: 'Successfully removed' }),
      );

      await client.deleteEventParticipant(50797);

      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'delete',
          url: 'https://api.virtuagym.com/api/v1/club/12345/eventparticipants/50797?api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('throws VirtuaGymApiError when no active participant exists', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'no active event participant found',
          result_count: 0,
          timestamp: 1456505412906,
        },
      });

      const error = await client
        .deleteEventParticipant(999)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 420 });
    });
  });

  const membershipInstance = (instance_id: number) => ({
    instance_id,
    member_id: 77038,
    membership_id: 584,
    active: false,
    cancelled: true,
    contract_autorenewed: false,
    completed: true,
    paused: false,
    stopped: false,
    start_date: '2026-04-01',
    contract_start_date: '2026-05-01',
    contract_end_date: '2026-07-31',
    membership_name: 'Test',
  });

  describe('membershipInstances', () => {
    it('retrieves instances filtered by member', async () => {
      const instances = [membershipInstance(2537)];
      requestMock.mockResolvedValue(envelope(instances));

      const result = await client.allMembershipInstances({ memberId: 77038 });

      expect(result).toEqual(instances);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/membership/instance?sync_from=0&from_id=0&member_id=77038&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('pages on from_id = last instance_id + 1 (from_id is inclusive)', async () => {
      const page1 = [membershipInstance(1), membershipInstance(2)];
      const page2 = [membershipInstance(3)];
      requestMock
        .mockResolvedValueOnce(envelope(page1, 1))
        .mockResolvedValueOnce(envelope(page2, 0));

      const result = await client.allMembershipInstances();

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/membership/instance?sync_from=0&from_id=3&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  describe('createMembershipInstance', () => {
    it('creates a contract and coerces contract_number to string', async () => {
      requestMock.mockResolvedValue(
        envelope({
          id: 988796319,
          contract_number: 2037,
          membership_id: 10215539,
          member_id: 1750534197,
          start_date: '2026-06-22',
          contract_start_date: '2026-07-01',
          contract_end_date: '2027-06-30',
          contract_active: true,
          contract_payment_method: 'cash',
          discount_duration: {
            discount_duration_time: null,
            discount_duration_term: null,
          },
        }),
      );

      const contract = await client.createMembershipInstance({
        membership_id: 10215539,
        member_id: 1750534197,
        start_date: '2026-06-22',
        payment_method: 'cash',
        salesperson_id: -5,
      });

      expect(contract.contract_number).toBe('2037');
      expect(contract.contract_active).toBe(true);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'post',
          url: 'https://api.virtuagym.com/api/v1/club/12345/membership/instance?api_key=test-api-key&club_secret=test-club-secret',
          data: {
            membership_id: 10215539,
            member_id: 1750534197,
            start_date: '2026-06-22',
            payment_method: 'cash',
            salesperson_id: -5,
          },
        }),
      );
    });

    it('propagates in-band validation errors', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 400,
          statusmessage: "Field 'membership_id' is required",
          result_count: 0,
          timestamp: 1755014123353,
        },
      });

      const error = await client
        .createMembershipInstance({
          membership_id: 0,
          member_id: 1,
          start_date: '2026-06-22',
          payment_method: 'cash',
          salesperson_id: 1,
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 400 });
    });
  });

  describe('membershipDefinitions', () => {
    const definition = (membership_id: number) => ({
      membership_id,
      membership_name: 'Basistarif 1',
      membership_group: 'default',
      membership_available_online: false,
      membership_duration: 6,
      membership_duration_type: 'months',
      membership_auto_renew: true,
      membership_pro_rata_start: false,
      membership_price: 79,
      membership_price_term: 'monthly',
      // The API returns tax_id both as number and as numeric string.
      membership_club_tax: {
        tax_id: '1',
        tax_name: 'BTW 21%',
        tax_percentage: 21,
      },
      default_payment_method: 'direct_debit',
    });

    it('retrieves definitions with a status filter, coercing tax_id', async () => {
      requestMock.mockResolvedValue(envelope([definition(5774756)]));

      const result = await client.allMembershipDefinitions({
        status: 'active',
      });

      expect(result[0]?.membership_club_tax?.tax_id).toBe(1);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/membership/definition?sync_from=0&status=active&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('pages with the page parameter while results remain', async () => {
      requestMock
        .mockResolvedValueOnce(envelope([definition(1)], 120))
        .mockResolvedValueOnce(envelope([definition(2)], 95))
        .mockResolvedValueOnce(envelope([definition(3)], 0));

      const result = await client.allMembershipDefinitions();

      expect(result.map((d) => d.membership_id)).toEqual([1, 2, 3]);
      expect(requestMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/membership/definition?sync_from=0&page=2&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
      expect(requestMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/membership/definition?sync_from=0&page=3&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });
  });

  const clubEvent = (event_id: string): ClubEvent => ({
    event_id,
    schedule_id: 1,
    start: '2026-03-02 17:00:00',
    end: '2026-03-02 18:00:00',
    title: 'Ski Fit',
    employee_note: '',
    club_id: 12345,
    activity_id: 448,
    instructor_id: 0,
    attendees: 0,
    max_places: 25,
    bookable: 1,
    cancel_before_duration: 0,
    booking_in_advance_duration: '1 months',
    canceled: false,
    presence_saved: false,
    language: '',
  });

  describe('allEvents', () => {
    it('retrieves events with all query parameters', async () => {
      const events = [clubEvent('1945791969-54d4caf4db7821-10175268')];
      requestMock.mockResolvedValue(envelope(events));

      const result = await client.allEvents({
        timestampStart: 1456876800,
        timestampEnd: 1456963200,
        memberId: 42,
        scheduleId: 1,
      });

      expect(result).toEqual(events);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          method: 'get',
          url: 'https://api.virtuagym.com/api/v1/club/12345/events?sync_from=0&timestamp_start=1456876800&timestamp_end=1456963200&member_id=42&schedule_id=1&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('coerces a numeric event_id to string', async () => {
      requestMock.mockResolvedValue(
        envelope([{ ...clubEvent('ignored'), event_id: 123456 }]),
      );

      const [event] = await client.allEvents();

      expect(event?.event_id).toBe('123456');
    });

    it('advances sync_from to the response timestamp while results remain', async () => {
      const page1 = [clubEvent('event-1')];
      const page2 = [clubEvent('event-2')];
      requestMock
        .mockResolvedValueOnce({
          data: {
            status: {
              statuscode: 200,
              statusmessage: 'Everything OK',
              result_count: 1,
              timestamp: 1785274600000,
              results_remaining: 1,
            },
            result: page1,
          },
        })
        .mockResolvedValueOnce({
          data: {
            status: {
              statuscode: 200,
              statusmessage: 'Everything OK',
              result_count: 1,
              timestamp: 1785274700000,
              results_remaining: 0,
            },
            result: page2,
          },
        });

      const result = await client.allEvents();

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenCalledTimes(2);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/events?sync_from=1785274600000&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('propagates in-band API errors', async () => {
      requestMock.mockResolvedValue({
        data: {
          statuscode: 420,
          statusmessage: 'timestamp_start must be >= 0',
          result_count: 0,
          timestamp: 1439302743,
        },
      });

      const error = await client
        .allEvents({ timestampStart: -1 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({
        statuscode: 420,
        statusmessage: 'timestamp_start must be >= 0',
      });
    });
  });

  describe('events', () => {
    it('does not yield a page for a club without events', async () => {
      requestMock.mockResolvedValue(envelope([]));

      const pages = [];
      for await (const page of client.events()) {
        pages.push(page);
      }

      expect(pages).toEqual([]);
    });
  });

  describe('event', () => {
    it('retrieves a single event by id, url-encoding the id', async () => {
      const event = clubEvent('1945791969-54d4caf4db7821-10175268');
      requestMock.mockResolvedValue(envelope([event]));

      const result = await client.event('1945791969-54d4caf4db7821-10175268');

      expect(result).toEqual(event);
      expect(requestMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          url: 'https://api.virtuagym.com/api/v1/club/12345/events/1945791969-54d4caf4db7821-10175268?sync_from=0&api_key=test-api-key&club_secret=test-club-secret',
        }),
      );
    });

    it('accepts a bare object result', async () => {
      const event = clubEvent('event-1');
      requestMock.mockResolvedValue(envelope(event));

      const result = await client.event('event-1');

      expect(result).toEqual(event);
    });

    it('throws VirtuaGymApiError when the result array is empty', async () => {
      requestMock.mockResolvedValue(envelope([]));

      const error = await client.event('missing').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VirtuaGymApiError);
      expect(error).toMatchObject({ statuscode: 420 });
    });
  });
});
