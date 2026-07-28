import { describe, expect, it } from 'vitest';
import { VirtuaGymClientV1 } from './virtuagym-client-v1';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name} — add it to your .env file`,
    );
  }
  return value;
}

describe('VirtuaGymClientV1 smoke test (live API)', () => {
  const client = new VirtuaGymClientV1({
    apiKey: requireEnv('VIRTUAGYM_API_KEY'),
    clubSecret: requireEnv('VIRTUAGYM_CLUB_SECRET'),
    clubId: Number(requireEnv('VIRTUAGYM_CLUB_ID')),
  });

  it('retrieves employees from the live API', async () => {
    const employees = await client.allEmployees();

    expect(Array.isArray(employees)).toBe(true);
    for (const employee of employees) {
      expect(employee).toMatchObject({
        member_id: expect.any(Number),
        club_id: expect.any(Number),
        firstname: expect.any(String),
        lastname: expect.any(String),
      });
    }
  });

  it('retrieves all members across pages without duplicates', async () => {
    const members = await client.allMembers();

    expect(members.length).toBeGreaterThan(0);
    // Pagination must not duplicate or drop members across page boundaries.
    const uniqueIds = new Set(members.map((m) => m.member_id));
    expect(uniqueIds.size).toBe(members.length);
  });

  it('retrieves a single member with memberships from the live API', async () => {
    const { value: firstPage } = await client.members().next();
    const first = firstPage?.[0];
    if (!first) {
      throw new Error('Club has no members to smoke-test against');
    }

    const single = await client.member(first.member_id, {
      with: 'memberships',
    });

    expect(single.member_id).toBe(first.member_id);
    expect(Array.isArray(single.memberships)).toBe(true);
  });

  it('retrieves club events from the live API', async () => {
    const now = Math.floor(Date.now() / 1000);
    const events = await client.allEvents({
      timestampStart: now - 90 * 86400,
      timestampEnd: now + 90 * 86400,
    });

    // The club may legitimately have no events; the value of this test is
    // that the request succeeds and every returned event passes the schema.
    expect(Array.isArray(events)).toBe(true);
    for (const event of events) {
      expect(typeof event.event_id).toBe('string');
      expect(event.club_id).toBe(Number(process.env['VIRTUAGYM_CLUB_ID']));
    }
  });

  it('retrieves a single employee from the live API', async () => {
    // Only the first page is needed to pick a member_id.
    const { value: firstPage } = await client.employees().next();
    const first = firstPage?.[0];
    if (!first) {
      throw new Error('Club has no employees to smoke-test against');
    }

    const single = await client.employee(first.member_id);

    expect(single.member_id).toBe(first.member_id);
    expect(single.firstname).toBe(first.firstname);
    expect(single.lastname).toBe(first.lastname);
  });
});
