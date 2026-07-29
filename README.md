# @golddevelopment/virtuagym-node

[![CI](https://github.com/gold-development/virtuagym-node/actions/workflows/ci.yml/badge.svg)](https://github.com/gold-development/virtuagym-node/actions/workflows/ci.yml)
![coverage](https://img.shields.io/badge/coverage-95.17%25-brightgreen)
[![npm version](https://img.shields.io/npm/v/%40golddevelopment%2Fvirtuagym-node)](https://www.npmjs.com/package/@golddevelopment/virtuagym-node)

A typed Node.js client for the [Virtuagym API](https://github.com/virtuagym/Virtuagym-Public-API/wiki) (v1, api key + club secret).

- **TypeScript-first** — full typings, validated at runtime with [zod](https://zod.dev): responses that don't match the documented schema fail loudly instead of corrupting your data.
- **Works everywhere** — ships both ESM and CommonJS builds; use `import` or `require` from TypeScript or JavaScript.
- **Tree-shakable** — ESM build with `sideEffects: false` and per-feature entry points, so bundlers only include what you use.
- **Pagination handled** — iterate lazily page by page, or fetch everything with one call.

## Installation

```bash
npm install @golddevelopment/virtuagym-node
```

## Getting started

You need three values, all found in Virtuagym under **Business settings → Business Info → Advanced**:

| Option       | Description                                     |
| ------------ | ----------------------------------------------- |
| `apiKey`     | Your API key                                    |
| `clubSecret` | The "Club Key" (sent as `club_secret`)          |
| `clubId`     | The ID of your club (a sub-club in case of a chain) |

```ts
import { VirtuaGymClientV1 } from '@golddevelopment/virtuagym-node/client';

const client = new VirtuaGymClientV1({
  apiKey: process.env.VIRTUAGYM_API_KEY!,
  clubSecret: process.env.VIRTUAGYM_CLUB_SECRET!,
  clubId: 12345,
});
```

CommonJS works too:

```js
const { VirtuaGymClientV1 } = require('@golddevelopment/virtuagym-node/client');
```

## Employees

### List employees

```ts
// Lazily, page by page — each HTTP request only happens when you ask for the next page
for await (const page of client.employees()) {
  console.log(`received ${page.length} employees`);
}

// Or collect every page into a single array
const everyone = await client.allEmployees();
```

Options (both methods):

| Option         | Type      | Description                                                                 |
| -------------- | --------- | --------------------------------------------------------------------------- |
| `syncFrom`     | `number`  | Incremental sync: only employees edited on/after this timestamp (ms).       |
| `clubMemberId` | `number`  | Filter on the custom ID from the external system ("Own member ID").         |
| `rfidTag`      | `string`  | Filter on the Rf-ID tag tied to the employee.                               |
| `anySubClub`   | `boolean` | Also search other sub-clubs of the chain. Requires the super club's secret. |
| `with`         | `string`  | Passed through as the `with` URL parameter (values undocumented by the API).|

For incremental sync, store the highest `timestamp_edit` you've seen and pass it as `syncFrom` on the next run:

```ts
const changed = await client.allEmployees({ syncFrom: lastSyncTimestamp });
```

### Get a single employee

```ts
const employee = await client.employee(7302399);

// Across a chain (requires the super club's club_secret):
const employee = await client.employee(7302399, { anySubClub: true });
```

### Create, update, upsert

```ts
// Create — Virtuagym may send an e-mail invite depending on club settings
const created = await client.createEmployee({
  firstname: 'Jane',
  lastname: 'Doe',
  email: 'jane@example.com',
  add_priviliges: ['coach'],
});

// Update by member_id
const updated = await client.updateEmployee(created.member_id, {
  gender: 'f',
  add_priviliges: ['club_manager'],
  remove_priviliges: ['coach'],
});

// Create or update, matched on external_id
const upserted = await client.createOrUpdateEmployee({
  external_id: 'employee1101',
  firstname: 'Jane',
  lastname: 'Doe',
});
```

All mutations return the canonical, fully validated `Employee` record (the client re-fetches it after the mutation, because the API's PUT responses use inconsistent field formats).

Supported privileges: `club_manager`, `assistent_manager`, `marketing_manager`, `coach`, `financial`, `employee`, `scheduling`, `default` (typed as `EmployeePrivilege`).

## Members

### List members

```ts
// Lazily, page by page (pages of 500)
for await (const page of client.members()) {
  console.log(`received ${page.length} members`);
}

// Or collect everything
const everyone = await client.allMembers();

// Incremental sync
const changed = await client.allMembers({ syncFrom: lastSyncTimestamp });
```

Options: `syncFrom` (ms), `clubMemberId`, `rfidTag`, `externalId`, `email`, `anySubClub`, and `with`.

### Get a single member

```ts
const member = await client.member(7302399);

// With membership instances embedded:
const member = await client.member(7302399, { with: 'memberships' });
member.memberships; // MembershipInstance[]
```

`with` accepts `'memberships'` (all) or `'active_memberships'`.

### Create, update, upsert, transfer

```ts
const created = await client.createMember({
  firstname: 'John',
  lastname: 'Doe',
  email: 'john@example.com',
  level_id: 2,
  goal_id: 4,
});

const updated = await client.updateMember(created.member_id, { gender: 'f' });

// Matched on external_id; also transfers between sub-clubs when
// club_external_id targets another sub-club (use the super club's id+secret)
const upserted = await client.createOrUpdateMember({
  external_id: '1ABC234567',
  firstname: 'John',
  lastname: 'Doe',
});
```

Like employee mutations, member mutations re-fetch and return the canonical validated record. After a sub-club transfer the re-fetch automatically retries with `any_sub_club=1`.

### Activate a user account

```ts
const { user_id } = await client.activateUser({
  email: 'user@example.com',
  password: 'their-new-password',
  member_identifier: { type: 'member_id', value: 7302399 },
});
```

Set `connect_to_existing: true` (and omit `password`) to connect the member to an existing user account. Validation failures throw `VirtuaGymApiError` with the endpoint's error list in `error.errors`.

## Memberships

### Membership instances (contracts of members)

```ts
// All instances of the club, or lazily page by page via client.membershipInstances()
const instances = await client.allMembershipInstances();

// Only one member's instances
const theirs = await client.allMembershipInstances({ memberId: 7302399 });
```

### Create a membership instance (assign a contract)

```ts
const contract = await client.createMembershipInstance({
  membership_id: 10215539,
  member_id: 7302399,
  start_date: '2026-08-01',
  payment_method: 'direct_debit',
  salesperson_id: 12345,
  // optional: discount_id + discount_start_date, or custom_discount, contract_notes, bill_to
});
```

### Membership definitions (the products a club sells)

```ts
// All definitions, or lazily page by page (25/page) via client.membershipDefinitions()
const definitions = await client.allMembershipDefinitions({ status: 'active' });
```

`status` accepts `'all'` (API default), `'active'`, or `'inactive'`.

## Club events

### List events

```ts
const now = Math.floor(Date.now() / 1000);

// Lazily, page by page
for await (const page of client.events({ scheduleId: 1 })) {
  console.log(`received ${page.length} events`);
}

// Or collect everything matching the query
const events = await client.allEvents({
  timestampStart: now,            // seconds
  timestampEnd: now + 7 * 86400,  // seconds
  memberId: 7302399,              // only events booked by this member
});
```

Options (both methods):

| Option           | Type     | Description                                                    |
| ---------------- | -------- | -------------------------------------------------------------- |
| `syncFrom`       | `number` | Only events edited on/after this timestamp (**milliseconds**). |
| `timestampStart` | `number` | Start of the event time range (**seconds**).                   |
| `timestampEnd`   | `number` | End of the event time range (**seconds**).                     |
| `memberId`       | `number` | Only events booked by this member.                             |
| `scheduleId`     | `number` | Only events belonging to this schedule.                        |

Note the API's unit mismatch: `syncFrom` is in milliseconds while the range timestamps are in seconds.

### Get a single event

```ts
const event = await client.event('1945791969-54d4caf4db7821-10175268');
```

Event `start`/`end` are datetime strings (`"YYYY-MM-DD HH:mm:ss"`) in the **club's timezone**, and `event_id` is a string.

## Event participants (bookings)

```ts
// Participants of events in a time window (API default: today ± 1 month),
// or lazily page by page via client.eventParticipants()
const participants = await client.allEventParticipants({
  timestampStart: now,           // seconds
  timestampEnd: now + 7 * 86400, // seconds
  // or scope to one event: eventId: '1977058374-...'
  // fillGuestname: true fills user_name for guest bookings
});

// A single booking
const booking = await client.eventParticipant(49977);

// Book a member into an event (store the returned event_participant_id!)
const created = await client.createEventParticipant({
  event_id: '1125559680-54d4cadf992ff6-77810154',
  member_id: 12345,
  send_email: true,
});

// Mark the ticket as printed (the only attribute the API allows updating)
await client.updateEventParticipant(created.event_participant_id, {
  ticket_printed: true,
});

// Cancel the booking
await client.deleteEventParticipant(created.event_participant_id);
```

Booking failures surface as `VirtuaGymApiError` with the API's statuscode: `430` (event not bookable / class full), `432` (not enough credits), `420` (validation).

## Invoices

```ts
// Lazily, page by page (500/page) — clubs can have thousands of invoices
for await (const page of client.invoices()) {
  console.log(`received ${page.length} invoices`);
}

// Or everything at once (allInvoices()), if you really need it

// A single invoice — by GUID (the numeric id is not accepted by the API)
const invoice = await client.invoice('982cdf0dca599cb31f968c59c8a525a16b84');

// Create an invoice
const created = await client.createInvoice({
  member_id: 7302399,
  payment_method: 'card', // 'cash' | 'card' | 'directdebit_NL' | 'bank_transfer' | 'check' | 'online'
  rows: [
    { name: 'Apple', desc: 'This is an apple', price: 1.5, amount: 1, tax_id: 0 },
  ],
});
created.rows; // InvoiceRow[] — prices include VAT
```

The invoices list supports no filters (the API ignores `sync_from` here).

## Club taxes

```ts
const taxes = await client.clubTaxes();
// [{ club_tax_id: 1, tax_id: '98a782…', tax_name: 'BTW 21%', tax_perc: '21.00', date_from: '1970-01-01' }]
```

The numeric `club_tax_id` (undocumented by the API) is the id you pass as `tax_id` when creating invoices and membership instances.

## Income categories

```ts
const categories = await client.incomeCategories();
// [{ income_category_id: '807351…', income_category_name: 'Memberships',
//    default_tax: null, default_tax_id: null, ... }]
```

Not paginated; `default_tax`/`default_tax_id` are `null` when no default tax is set.

## Models

Types and zod schemas are importable separately — handy in a frontend that only needs the shapes:

```ts
import { employeeSchema, type Employee } from '@golddevelopment/virtuagym-node/models';
```

Field names match the API's wire format (snake_case), including the API's own spelling of `priviliges`.

## Error handling

```ts
import { VirtuaGymApiError } from '@golddevelopment/virtuagym-node/client';

try {
  await client.employee(999);
} catch (error) {
  if (error instanceof VirtuaGymApiError) {
    // In-band API errors (the API reports these with HTTP 200)
    console.error(error.statuscode, error.statusmessage); // e.g. 420 'Not found.'
  }
}
```

Three kinds of errors can surface:

- **`VirtuaGymApiError`** — the API itself reported an error (e.g. statuscode 420 "Not found"). These arrive with HTTP 200; the client detects and throws them.
- **`AxiosError`** — transport-level failures (network errors, non-2xx HTTP statuses).
- **`ZodError`** — the response did not match the documented schema, naming the exact offending field.

## Development

```bash
npm install
npm test               # unit tests (offline, mocked HTTP)
npm run test:coverage  # unit tests + coverage report; refreshes the README badge
npm run build          # typecheck + build ESM/CJS bundles into dist/

# Smoke tests against the live API (read-only):
cp .env.example .env  # then fill in your credentials
npm run test:smoke
```

## License

MIT
