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

  it('retrieves all membership instances across pages without duplicates', async () => {
    const instances = await client.allMembershipInstances();

    const uniqueIds = new Set(instances.map((i) => i.instance_id));
    expect(uniqueIds.size).toBe(instances.length);
    for (const instance of instances) {
      expect(typeof instance.active).toBe('boolean');
    }
  });

  it('retrieves all membership definitions across pages without duplicates', async () => {
    const definitions = await client.allMembershipDefinitions();

    const uniqueIds = new Set(definitions.map((d) => d.membership_id));
    expect(uniqueIds.size).toBe(definitions.length);
  });

  it('retrieves event participants from the live API', async () => {
    // Default window: (today - 1 month) .. (today + 1 month).
    const participants = await client.allEventParticipants();

    expect(Array.isArray(participants)).toBe(true);
    for (const p of participants) {
      expect(typeof p.event_participant_id).toBe('number');
      expect(typeof p.event_id).toBe('string');
    }
  });

  it('retrieves invoices page by page without duplicates', async () => {
    // The club has thousands of invoices; three pages suffice to prove the
    // pagination boundaries are exact.
    const guids = new Set<string>();
    let total = 0;
    let pages = 0;
    for await (const page of client.invoices()) {
      for (const invoice of page) {
        guids.add(invoice.guid);
        total += 1;
      }
      pages += 1;
      if (pages >= 3) break;
    }

    expect(total).toBeGreaterThan(0);
    expect(guids.size).toBe(total);
  });

  it('retrieves a single invoice by guid from the live API', async () => {
    const { value: firstPage } = await client.invoices().next();
    const first = firstPage?.[0];
    if (!first) {
      throw new Error('Club has no invoices to smoke-test against');
    }

    const single = await client.invoice(first.guid);

    expect(single.guid).toBe(first.guid);
    expect(single.club_id).toBe(Number(process.env['VIRTUAGYM_CLUB_ID']));
  });

  it('retrieves income categories from the live API', async () => {
    const categories = await client.incomeCategories();

    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      expect(typeof category.income_category_id).toBe('string');
      expect(typeof category.income_category_name).toBe('string');
    }
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
