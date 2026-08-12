import { describe, expect, it } from 'vitest';
import { VirtuaGymClientV3 } from './virtuagym-client-v3';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name} — add it to your .env file`,
    );
  }
  return value;
}

describe('VirtuaGymClientV3 smoke test (live API)', () => {
  const client = new VirtuaGymClientV3({
    clientId: requireEnv('VIRTUAGYM_CLIENT_ID'),
    clientSecret: requireEnv('VIRTUAGYM_CLIENT_SECRET'),
    clubId: Number(requireEnv('VIRTUAGYM_CLUB_ID')),
  });

  it('retrieves all leads across pages without duplicates', async () => {
    const leads = await client.allLeads();

    expect(leads.length).toBeGreaterThan(0);
    const uniqueIds = new Set(leads.map((l) => l.lead_id));
    expect(uniqueIds.size).toBe(leads.length);
    for (const lead of leads) {
      expect(lead).toMatchObject({
        lead_id: expect.any(String),
        lead_guid: expect.any(String),
        firstname: expect.any(String),
        lastname: expect.any(String),
      });
    }
  });

  it('paginates consistently with a small page size', async () => {
    const [byDefault, bySmallPages] = await Promise.all([
      client.allLeads(),
      client.allLeads({ limit: 10 }),
    ]);

    expect(bySmallPages.map((l) => l.lead_id).sort()).toEqual(
      byDefault.map((l) => l.lead_id).sort(),
    );
  });

  it('retrieves a single lead', async () => {
    const { value: firstPage } = await client.leads({ limit: 1 }).next();
    const first = firstPage?.[0];
    if (!first) {
      throw new Error('Club has no leads to smoke-test against');
    }

    const single = await client.lead(first.lead_id);

    expect(single.lead_id).toBe(first.lead_id);
    expect(single.lead_guid).toBe(first.lead_guid);
  });

  // The schedule tests require the schedule integration scope
  // (schedule_public_api_club_<club_id>) on the OAuth client.
  const week = 7 * 24 * 3600 * 1000;
  const dateStart = Date.now() - week;
  const dateEnd = Date.now() + week;

  it('retrieves schedule events across pages without duplicates', async () => {
    const events = await client.allEvents({ dateStart, dateEnd });

    expect(events.length).toBeGreaterThan(0);
    // event_id repeats for occurrences of recurring events; the occurrence
    // (event_id + start time) must be unique.
    const keys = new Set(
      events.map((e) => `${e.event_id}|${e.datetime_start}`),
    );
    expect(keys.size).toBe(events.length);
    for (const event of events) {
      expect(event).toMatchObject({
        event_id: expect.any(String),
        datetime_start: expect.any(Number),
        datetime_end: expect.any(Number),
      });
    }
  });

  it('retrieves a single schedule event', async () => {
    const { value: firstPage } = await client
      .events({ dateStart, dateEnd })
      .next();
    const first = firstPage?.[0];
    if (!first) {
      throw new Error('Club has no schedule events to smoke-test against');
    }

    const single = await client.event(first.event_id);

    expect(single.event_id).toBe(first.event_id);
  });

  it('retrieves event bookings in a date range', async () => {
    const events = await client.allEventBookings({ dateStart, dateEnd });

    // A 204 (no bookings) yields an empty array; both are valid.
    for (const event of events) {
      expect(event.event_id).toEqual(expect.any(String));
      for (const participant of event.participants ?? []) {
        expect(participant.member_id).toEqual(expect.any(Number));
      }
    }
  });
});
