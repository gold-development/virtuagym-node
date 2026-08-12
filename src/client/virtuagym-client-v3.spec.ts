import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { Lead } from '../models/lead';
import type { ScheduleEvent } from '../models/schedule-event';
import { VirtuaGymClientV3, VirtuaGymV3ApiError } from './virtuagym-client-v3';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: () => ({ request: requestMock }),
    isAxiosError: (error: unknown) =>
      (error as { isAxiosError?: boolean } | null)?.isAxiosError === true,
  },
}));

const TOKEN_URL =
  'https://iam.services.virtuagym.com/auth/realms/virtuagym/protocol/openid-connect/token';
const GATEWAY_URL = 'https://gateway.services.virtuagym.com';

describe('VirtuaGymClientV3', () => {
  let client: VirtuaGymClientV3;

  const tokenResponse = (accessToken = 'test-token') => ({
    status: 200,
    data: { access_token: accessToken, expires_in: 1800 },
  });

  const lead = (lead_id: string): Lead => ({
    lead_id,
    lead_guid: `guid-${lead_id}`,
    club_id: '12345',
    status_id: '1',
    source_id: '2',
    owner_id: '0',
    firstname: 'Jane',
    lastname: 'Doe',
    email: 'jane.doe@example.com',
    phone: '',
    mobile: '',
    gender: '',
    birthday: null,
    address: '',
    address_2: '',
    zip_code: '',
    city: '',
    state: '',
    country: '',
    language: '',
    picture: '',
    converted_to_member_id: '0',
    external_id: '',
    lead_since: '2026-08-01',
    created_by_user_id: '100',
    edited_by_user_id: '100',
    deleted: '0',
    timestamp_created: '1785836412',
    timestamp_edited: '1786448091',
    inactive: '0',
  });

  const leadsEnvelope = (leads: Lead[]) => ({
    status: 200,
    data: { status: 'success', message: '', data: { leads } },
  });

  const event = (event_id: string): ScheduleEvent => ({
    event_id,
    datetime_start: 1786500000000,
    datetime_end: 1786503600000,
  });

  const eventsEnvelope = (events: ScheduleEvent[], total_pages = 1) => ({
    status: 200,
    data: {
      status: 'success',
      status_code: 200,
      data: { events, total_pages },
    },
  });

  const axiosError = (status: number, data: unknown) => ({
    isAxiosError: true,
    response: { status, data },
  });

  beforeEach(() => {
    requestMock.mockReset();
    client = new VirtuaGymClientV3({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      clubId: 12345,
    });
  });

  describe('authentication', () => {
    it('requests a client-credentials token with the club header', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(leadsEnvelope([]));

      await client.allLeads();

      expect(requestMock).toHaveBeenNthCalledWith(1, {
        method: 'post',
        url: TOKEN_URL,
        data: 'client_id=test-client-id&client_secret=test-client-secret&grant_type=client_credentials',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-represent-club-id': '12345',
        },
      });
      expect(requestMock).toHaveBeenNthCalledWith(2, {
        method: 'get',
        url: `${GATEWAY_URL}/v3/clubs/12345/leads?page=1&limit=100`,
        data: undefined,
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('reuses the cached token until it expires', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValue(leadsEnvelope([]));

      await client.allLeads();
      await client.allLeads();

      const tokenCalls = requestMock.mock.calls.filter(
        (call) => (call[0] as { url?: string }).url === TOKEN_URL,
      );
      expect(tokenCalls).toHaveLength(1);
    });

    it('refreshes the token and retries once on a 401', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse('stale-token'))
        .mockRejectedValueOnce(
          axiosError(401, { message: 'Token not valid.', status: 'fail' }),
        )
        .mockResolvedValueOnce(tokenResponse('fresh-token'))
        .mockResolvedValueOnce(leadsEnvelope([lead('1')]));

      const result = await client.allLeads();

      expect(result).toHaveLength(1);
      expect(requestMock).toHaveBeenCalledTimes(4);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fresh-token',
          }),
        }),
      );
    });

    it('does not retry a second consecutive 401', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockRejectedValueOnce(
          axiosError(401, { message: 'Token not valid.', status: 'fail' }),
        )
        .mockResolvedValueOnce(tokenResponse())
        .mockRejectedValueOnce(
          axiosError(401, { message: 'Token not valid.', status: 'fail' }),
        );

      await expect(client.allLeads()).rejects.toThrow(
        'Virtuagym API v3 error 401: Token not valid.',
      );
      expect(requestMock).toHaveBeenCalledTimes(4);
    });

    it('surfaces token endpoint errors as VirtuaGymV3ApiError', async () => {
      requestMock.mockRejectedValueOnce(
        axiosError(401, {
          error: 'invalid_client',
          error_description: 'Invalid client or Invalid client credentials',
        }),
      );

      await expect(client.allLeads()).rejects.toThrow(
        new VirtuaGymV3ApiError(
          401,
          'Invalid client or Invalid client credentials',
        ),
      );
    });
  });

  describe('leads', () => {
    it('retrieves the leads of the club', async () => {
      const leads = [lead('1'), lead('2')];
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(leadsEnvelope(leads));

      const result = await client.allLeads();

      expect(result).toEqual(leads);
    });

    it('follows pagination until a short page', async () => {
      const page1 = [lead('1'), lead('2')];
      const page2 = [lead('3')];
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(leadsEnvelope(page1))
        .mockResolvedValueOnce(leadsEnvelope(page2));

      const result = await client.allLeads({ limit: 2 });

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: `${GATEWAY_URL}/v3/clubs/12345/leads?page=1&limit=2`,
        }),
      );
      expect(requestMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          url: `${GATEWAY_URL}/v3/clubs/12345/leads?page=2&limit=2`,
        }),
      );
    });

    it('retrieves a single lead', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'success',
          message: '',
          data: { name: 'Lead Detail', lead: lead('7') },
        },
      });

      const result = await client.lead(7);

      expect(result.lead_id).toBe('7');
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: `${GATEWAY_URL}/v3/clubs/12345/leads/7`,
        }),
      );
    });

    it('throws VirtuaGymV3ApiError when the lead does not exist', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockRejectedValueOnce(
        axiosError(404, {
          status: 'fail',
          error: { status: 'error', message: 'ERROR: Lead not found' },
        }),
      );

      await expect(client.lead(1)).rejects.toThrow(
        new VirtuaGymV3ApiError(404, 'ERROR: Lead not found'),
      );
    });

    it('creates a lead and re-fetches the canonical record', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({
          status: 200,
          data: {
            status: 'success',
            message: '',
            data: { status: 'success', message: 'Lead created', id: '99' },
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            status: 'success',
            message: '',
            data: { name: 'Lead Detail', lead: lead('99') },
          },
        });

      const result = await client.createLead({
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane.doe@example.com',
      });

      expect(result.lead_id).toBe('99');
      expect(requestMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: 'post',
          url: `${GATEWAY_URL}/v3/clubs/12345/leads`,
          data: {
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane.doe@example.com',
          },
        }),
      );
      expect(requestMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          method: 'get',
          url: `${GATEWAY_URL}/v3/clubs/12345/leads/99`,
        }),
      );
    });

    it('updates a lead and re-fetches the canonical record', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({
          status: 200,
          data: {
            status: 'success',
            message: '',
            // The update response returns the id as a number.
            data: { status: 'success', message: 'Lead updated', id: 99 },
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            status: 'success',
            message: '',
            data: { name: 'Lead Detail', lead: lead('99') },
          },
        });

      const result = await client.updateLead(99, { status_id: 12 });

      expect(result.lead_id).toBe('99');
      expect(requestMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: 'put',
          url: `${GATEWAY_URL}/v3/clubs/12345/leads/99`,
          data: { status_id: 12 },
        }),
      );
    });

    it('surfaces validation errors with the API message', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockRejectedValueOnce(
        axiosError(400, {
          status: 'fail',
          error: {
            status: 'fail',
            message:
              'At least one of fields `email`, `phone` and `mobile` are required.',
          },
        }),
      );

      await expect(
        client.createLead({ firstname: 'Jane', lastname: 'Doe' }),
      ).rejects.toThrow(
        'At least one of fields `email`, `phone` and `mobile` are required.',
      );
    });

    it('rejects malformed lead payloads', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          leadsEnvelope([{ nonsense: true } as unknown as Lead]),
        );

      await expect(client.allLeads()).rejects.toThrow(ZodError);
    });
  });

  describe('schedule events', () => {
    it('retrieves events with the required date range parameters', async () => {
      const events = [event('e-1')];
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(eventsEnvelope(events));

      const result = await client.allEvents({
        dateStart: 1786500000000,
        dateEnd: 1786600000000,
      });

      expect(result).toEqual(events);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events?date_start=1786500000000&date_end=1786600000000&page=1&page_size=100`,
        }),
      );
    });

    it('passes deleted and event_type filters', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(eventsEnvelope([]));

      await client.allEvents({
        dateStart: 1,
        dateEnd: 2,
        deleted: true,
        eventType: 'appointment',
      });

      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events?date_start=1&date_end=2&page=1&page_size=100&deleted=true&event_type=appointment`,
        }),
      );
    });

    it('follows total_pages across pages', async () => {
      const page1 = [event('e-1')];
      const page2 = [event('e-2')];
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(eventsEnvelope(page1, 2))
        .mockResolvedValueOnce(eventsEnvelope(page2, 2));

      const result = await client.allEvents({ dateStart: 1, dateEnd: 2 });

      expect(result).toEqual([...page1, ...page2]);
      expect(requestMock).toHaveBeenCalledTimes(3);
    });

    it('retrieves a single event', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        status: 200,
        data: { status: 'success', status_code: 200, data: event('e-42') },
      });

      const result = await client.event('e-42');

      expect(result.event_id).toBe('e-42');
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events/e-42`,
        }),
      );
    });
  });

  describe('bookings', () => {
    it('treats a 204 bookings response as an empty result', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ status: 204, data: '' });

      const result = await client.allEventBookings({
        dateStart: 1,
        dateEnd: 2,
      });

      expect(result).toEqual([]);
    });

    it('passes the participant filter when listing bookings', async () => {
      requestMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(eventsEnvelope([]));

      await client.allEventBookings({ dateStart: 1, dateEnd: 2, memberId: 7 });

      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events/bookings?date_start=1&date_end=2&page=1&page_size=100&member_id=7`,
        }),
      );
    });

    it('creates a booking and returns the booking attempts', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'accept',
          status_code: 200,
          bookings: [
            {
              booked: true,
              day: '2026-08-12',
              reason: 2,
              time_start: '07:00:00',
              time_end: '07:30:00',
            },
          ],
          total_bookings: 1,
        },
      });

      const result = await client.createBooking('e-42', { member_id: 7 });

      expect(result.total_bookings).toBe(1);
      expect(result.bookings[0]?.booked).toBe(true);
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'post',
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events/e-42/bookings`,
          data: { member_id: 7 },
        }),
      );
    });

    it('updates a booking', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        status: 202,
        data: { status: 'success', status_code: 202 },
      });

      await client.updateBooking('e-42', { member_id: 7, presence: true });

      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'put',
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events/e-42/bookings`,
          data: { member_id: 7, presence: true },
        }),
      );
    });

    it('cancels a booking with rule and refund flags', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        status: 200,
        data: { status: 'success', status_code: 200 },
      });

      await client.cancelBooking('e-42', {
        memberId: 7,
        refund: false,
        freeCancellationRange: false,
        cancellationRange: true,
      });

      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'delete',
          url: `${GATEWAY_URL}/private/v3/clubs/12345/schedule/integration/events/e-42/bookings?member_id=7&refund=false&free_cancellation_range=false&cancellation_range=true`,
        }),
      );
    });

    it('surfaces schedule errors with message and fields', async () => {
      requestMock.mockResolvedValueOnce(tokenResponse()).mockRejectedValueOnce(
        axiosError(400, {
          message: 'Invalid request',
          fields: ['date_start'],
          status: 'fail',
        }),
      );

      const promise = client.allEvents({ dateStart: 1, dateEnd: 2 });
      await expect(promise).rejects.toThrow(
        'Virtuagym API v3 error 400: Invalid request',
      );
      await expect(promise).rejects.toMatchObject({
        httpStatus: 400,
        fields: ['date_start'],
      });
    });
  });
});
