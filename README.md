# @golddevelopment/virtuagym-node

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
npm test            # unit tests (offline, mocked HTTP)
npm run build       # typecheck + build ESM/CJS bundles into dist/

# Smoke tests against the live API (read-only):
cp .env.example .env  # then fill in your credentials
npm run test:smoke
```

## License

MIT
