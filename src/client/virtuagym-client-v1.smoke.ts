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
