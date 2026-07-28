import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { Employee } from '../models/employee';
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
});
