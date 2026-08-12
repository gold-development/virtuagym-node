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

  // The schedule endpoints require the schedule integration scope on the
  // OAuth client, which our test credentials do not have (the JWT scope is
  // "mass-comm leads_<club>"); without it the API answers 401 "Token not
  // valid." — so there is no schedule smoke test yet.
});
