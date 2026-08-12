# Virtuagym Public API — documentation discrepancies and undocumented behavior

Findings from building and live-testing a typed client
([@golddevelopment/virtuagym-node](https://github.com/gold-development/virtuagym-node))
against all 15 documented v1 resources and the v3 leads API. Every item below
was verified against the live API (v1: July 2026, v3: August 2026) unless it
is a docs-internal inconsistency.

## Public API v1

## Pagination

1. **The documented cursor duplicates rows.** The docs advise paginating
   member/employee lists with `sync_from` = the last item's `timestamp_edit`
   (plus `from_id` for ties). Live test against a 550-member club: 551 rows
   fetched, 1 duplicate at the page boundary — `sync_from` filtering is
   inclusive.
2. **`status.next_page` is undocumented but is the accurate cursor for the
   member list.** Responses include e.g. `"next_page": "sync_from=1784035004986"`
   with a server-computed value (not derivable from the last item). Following
   it fetched 550/550 members exactly. This field is not mentioned anywhere in
   the docs.
3. **…but `next_page` duplicates rows on the membership endpoints.** Following
   `next_page` on `/membership/instance` returned 1,079 rows with 6
   duplicates (1,073 real); on `/membership/definition` 150 rows with 5
   duplicates (145 real). Timestamp ties again.
4. **`/membership/instance` `from_id` is inclusive.** Paginating with
   `from_id` = last `instance_id` repeats the boundary row on every page.
   `from_id` = last `instance_id` + 1 walks all 1,073 instances exactly.
5. **Omitting `from_id` on the first `/membership/instance` call changes the
   sort order.** With `from_id` present (0 is fine, as documented) results are
   ordered by `instance_id`; without it they appear timestamp-ordered, which
   breaks an `instance_id`-based cursor (48 duplicates / missing rows in a
   3-page walk). The docs hint at this ("it is allowed to pass 0") but don't
   say it is load-bearing.
6. **`/membership/definition` paginates correctly only via `page`.** The
   documented `page` parameter (25/page) fetched 145/145 exactly.
7. `results_remaining` is absent on some endpoints' status objects (e.g.
   events list without further pages, single-employee), though documented
   response examples show it.

## Response envelopes and status codes

8. **Errors are reported in-band with HTTP 200.** E.g. `420 Not found` arrives
   as an HTTP 200 whose body is a *flat* `{statuscode, statusmessage, ...}`
   (no `status`/`result` nesting). HTTP clients that only check transport
   status treat these as success.
9. **Three different envelope shapes exist**: nested success
   `{status: {...}, result}`, flat error `{statuscode, ...}`, and nested
   error-without-result `{status: {...}, errors: [...]}` (activate_user
   validation). The GET examples in the Employee/Member docs additionally show
   a flat *success* envelope that the live API does not use.
10. **`/member/create_or_update` returns statuscode 201 on create** (200 on
    update). Only mentioned in passing for members; the identically-shaped
    employee endpoint's docs don't mention it.
11. `status.timestamp` is milliseconds live, but several docs examples show
    seconds (e.g. `1429522483`).

## Field type discrepancies (all verified live)

12. **`gender` is not only `"m"/"f"`** — live data contains `"u"`. The docs
    enum is incomplete for both members and employees.
13. **`member_since`** is a millisecond timestamp live, but the docs' member
    GET/PUT examples show a `"YYYY-MM-DD"` string. Clients must accept both.
14. **`event_id` is documented as int but is a string** like
    `"1945791969-54d4caf4db7821-10175268"` (the docs' own example contradicts
    its STRUCTURE table).
15. **`contract_number`** (membership instance POST response) is documented
    as string but returned as a number (`2037`).
16. **`membership_club_tax.tax_id`** is returned both as number (`1`) and as
    numeric string (`"1"`) — visible in the docs' own definition example.
17. **Membership instance flags** (`active`, `cancelled`, …) are booleans on
    `/membership/instance` but `0`/`1` integers in the member-embedded
    `memberships` array (`with=memberships`), while the docs claim boolean in
    one table and show 0/1 in the other's example.
18. **PUT mutation responses are internally inconsistent**: the docs' own
    update examples show `active: 1` (int, elsewhere boolean),
    `member_since: "2015-01-14"` (string, elsewhere ms), and
    `timestamp_edit: 1478252652` (seconds, elsewhere ms). Treating mutation
    responses as authoritative is unsafe; a GET re-fetch returns canonical
    types.
19. **`custom_discount.discount_amount_type`**: the field table says
    `percentage, monetary`, the request example uses `"percent"`, and the
    error-message table says `monetary, percent, fixed`. Three conflicting
    enumerations for one field.
20. **`salesperson_id`** is documented "must be greater than 0", but the
    docs' own example uses `-5` (which the API accepts — presumably a system
    salesperson).

## Undocumented fields returned by the live API

21. Employee & member records: `registration_date` (ms), `original_member_id`,
    `user_id` (only present for members/employees with linked accounts),
    `early_booking_access` (documented for member, not employee), and
    `business_guid` (members only, sparse).
22. Employee records return `priviliges` (comma-separated role string) — shown
    in docs examples but missing from the GET STRUCTURE table. (Also note the
    field name's spelling is `priviliges` on the wire.)

## Endpoint shape quirks

23. **Single-resource GETs return one-element arrays**, not objects:
    `/employee/<id>`, `/member/<id>`, `/events/<id>` all wrap the record in
    `result: [...]`, while the PUT/POST examples show `result: {...}`.
24. The member GET list example omits `club_id`, `active` and `is_pro` on one
    of its two example records although the STRUCTURE table marks them
    non-optional (live data always includes them).
25. The employee endpoints support a `with` parameter per the METHODS table,
    but its accepted values are only documented for members
    (`memberships` / `active_memberships`).

## Income categories

26. **Two contradictory revisions of the Income Categories page exist.** One
    shows the payload under a `results` key with numeric
    `income_category_id`s (1..5) — and its example JSON is invalid (trailing
    comma after `timestamp`); the other shows `result` with GUID-string ids
    and nullable tax fields. The live API matches the second: `result`,
    GUID strings, `default_tax`/`default_tax_id` as `null` when unset.
27. The live income-category records include an undocumented `name_id`
    string field mentioned in neither revision.

## Invoices

28. **The single-invoice GET only resolves by guid.** The docs call the path
    parameter `invoice_id`, but passing the numeric `id` returns 420; only
    the guid works. Its result is a bare object, unlike the one-element
    arrays of other single-resource GETs.
29. **`next_page` changes type on the invoices list**: a plain page number
    (`2`) plus an undocumented `total_pages` field, whereas other endpoints
    return a query-string fragment (`"sync_from=…"`). Pagination is
    page-based; `sync_from` is accepted but silently ignored.
30. Undocumented invoice fields returned live: parent `sales_user_id`,
    `new_payment_method`, `timestamp_status`, `invoice_related_invoice`,
    `free_invoice_text`; row `sales_user_id`, `new_payment_method`,
    `start_period`, `end_period` (shown in examples but missing from the
    child field table), `related_invoice`.
31. The parent structure table lists the Optional column for `amount_due`
    and `timestamp` as literally "false" instead of "no" — and `vat` in the
    child table is described as "the total price of the invoice without the
    VAT" (copy-paste of the price_ex_vat description).

## Club taxes

32. **The Club Taxes page is mislabeled "Income Categories"** — title,
    intro, and the structure heading all say income categories, but the
    endpoint is `/club-taxes/` and the fields are tax fields. Its `tax_id`
    is declared int in the table, "the guid" in its own description, and is
    a GUID string live; the example again uses a `results` key (live:
    `result`) and contains invalid JSON (trailing comma).
33. Club taxes return an undocumented numeric `club_tax_id` — which appears
    to be the id actually referenced by invoice rows (`club_tax_id`) and
    membership-instance creation (`tax_id`), making the undocumented field
    the useful one.

## Member notes

34. **The notes endpoint cannot paginate beyond the newest 500 notes.**
    Results are sorted newest-first and `sync_from` filters *newer-than*, so
    the `next_page` cursor (`sync_from=<oldest timestamp of the page>`)
    returns the same newest 500 rows forever. Verified on a club with 831
    notes: an 11-request walk following `next_page` fetched 5,500 rows with
    only 500 unique; `page`, `from_id`, `offset`, `limit` and several other
    parameters are all silently ignored, and `results_remaining: 331` counts
    rows that no request can retrieve. The only workarounds are filtering by
    `member_id` (hoping per-member counts stay under 500) or `note_type`.
35. Notes `sync_from` and `timestamp` are in SECONDS, while most other
    endpoints use milliseconds for the same names. The DELETE response
    returns `note_id` as a string ("1277495") where every other note payload
    uses a number, notes return an undocumented `from_user_id`, and the
    error-message table omits `checkup` from the allowed note_type list that
    the same page documents.

## Member credits

36. Credits timestamps (`timestamp_created`/`timestamp_edited` and the
    `sync_from` parameter) are in SECONDS live, while the docs declare
    `sync_from` "in milliseconds". Rows carry no unique id (identity is the
    member_id + service_type pair) and include an undocumented
    `ts_needs_update` field on a few rows. The undocumented `next_page`
    cursor initially paginated exactly (verified: 929/929 unique across
    pages), but as the club's data grew it started duplicating rows on
    page-boundary timestamp ties (949 rows, 946 unique) — the
    seconds-resolution cursor is inclusive, like the millisecond cursors of
    items 1-3. `member_id` is optional on GET — omitting it lists the whole
    club, which the docs don't mention.

## Assign workout

37. The workout-assignment success response contains no `result` field at
    all — `{status: {...}}` only — unlike every other endpoint. The body
    field is `user_id` (the linked user account id) where the rest of the
    member endpoints key on `member_id`; since `user_id` is only present on
    members with activated accounts, workouts cannot be assigned via the
    API to members without one.

## Bodymetrics

38. **Bodymetrics uses a FLAT success envelope** (`{statuscode, ..., result}`
    with no nested `status` object) — the shape the docs show for several
    endpoints but which only this one actually uses live. Its errors also
    come with real HTTP status codes (400/404), unlike the
    in-band-with-HTTP-200 errors of the other resources.
39. Bodymetric rows are keyed by an undocumented `user_id` (linked account
    id) rather than `member_id`; live data contains undocumented types
    beyond the 19 documented (e.g. "sleep_score") plus an undocumented
    `timestamp_edit`; timestamps are in seconds; and the endpoint returns
    the full history in one response (no pagination — 873 rows observed in
    a single result). Members without an activated user profile get a
    misleading 404 "Member with member_id X not found in club".

---

*Method note: everything above was reproduced with plain GET/PUT/POST requests
against `https://api.virtuagym.com/api/v1` using api_key + club_secret
authentication on a single club (550 members, 1,073 membership instances, 145
membership definitions). Items 1–6 come from full pagination walks comparing
row counts and unique-ID counts.*

## Public API v3

Verified live (August 2026) against `gateway.services.virtuagym.com` with
OAuth client-credentials authentication, on a club with 194 leads.

### Authentication and scopes

40. **Resource access is scope-gated, and the error is misleading.** The
    access token's `scope` claim (e.g. `mass-comm leads_<club_id>`) is set
    when Virtuagym registers the OAuth client. Calling an endpoint outside
    the granted scopes (e.g. the appointment-schedule API) returns 401
    `{"message": "Token not valid.", "status": "fail"}` — indistinguishable
    from an expired token, even though the token is perfectly valid.
41. The `x-represent-club-id` token-request header documented for the leads
    API makes no observable difference for a club-registered client: the
    issued JWT carries the same `clubId` claim and scopes with or without
    it. (Presumably it matters for multi-club/partner clients.)

### Leads

42. **All lead fields are serialized as strings** — ids (`"751563"`), flags
    (`"0"`/`"1"` for `deleted`/`inactive`), and timestamps included; only
    `birthday` was observed as `null`. The create/update parameter table
    documents integers for `status_id`, `source` and `owner_id`.
43. **Lead timestamps are in SECONDS** (`timestamp_created`,
    `timestamp_edited`), as strings, while most v1 endpoints use
    milliseconds for the same concept.
44. **Pagination is undocumented but exists**: `page` (25 per page by
    default) and `limit` both work; the end is a short/empty page. The
    parameter names the neighbouring schedule API documents (`page_size`)
    plus `offset` and `sync_from` are all silently ignored — a `page_size`
    user gets the newest 25 rows forever without noticing.
45. **A single-lead GET endpoint exists** (`/v3/clubs/<id>/leads/<lead_id>`,
    undocumented), wrapping the record as `data: {name: "Lead Detail",
    lead: {...}}`. A wrong id yields HTTP 404 with a *doubly nested* error
    envelope: `{"status": "fail", "error": {"status": "error", "message":
    "ERROR: Lead not found"}}` (note `status` appearing twice with
    different values).
46. The leads list response contains undocumented `has_leads` (boolean) and
    `owners` (map of owner_id → `{member_id, firstname, lastname}`) fields
    next to `leads`. **`owners` changes type when empty**: it is a JSON
    object when a page has lead owners and an empty JSON *array* when not
    (PHP empty-associative-array serialization).
47. Undocumented lead fields returned live: `lead_guid`, `source_id` (the
    create parameter is named `source`), `picture`,
    `converted_to_member_id`, `created_by_user_id`, `edited_by_user_id`,
    `inactive`, `timestamp_created`, `timestamp_edited`.
48. **Create and update responses disagree on the id type**: create returns
    the new id as a string (`"id": "1234"`), update as a number
    (`"id": 2274`) — visible in the docs' own examples and confirmed live.
49. The documented parameter table says `status_id` is mandatory for
    creation, yet also documents a default of `1` (New); omitting it works.

### Appointment schedule

50. The Swagger specs' paths (`/private/v3/clubs/...`) are the real gateway
    routes — unlike the leads API there is no `/v3/...` alias (that path
    404s with a Kong "no Route matched" error), and despite the `/private/`
    prefix this is the public integration API. The required scope is named
    `schedule_public_api_club_<club_id>`.
51. **`event_id` is not unique per row.** Occurrences of a recurring event
    share the event_id and differ only in `datetime_start`/`datetime_end`
    (verified in both the events and bookings lists). The single-event GET
    takes no date parameter, so for recurring events it returns one
    occurrence of the API's choosing.
52. **`payment_info` contains undocumented `datetime_paid`,
    `datetime_update`, `datetime_created` fields — as RFC-1123 date
    strings** ("Wed, 27 Mar 2024 17:10:08 GMT"), the only place in either
    API generation that doesn't use numeric timestamps.
53. **The events and bookings endpoints disagree on how absent participant
    values are encoded**: `original_member_id` is `null` on
    `/events` but `0` on `/events/bookings`; `phone_number` and `email` are
    `""` on `/events` but `null` on `/events/bookings`, for the same
    participants. `meeting_link` is likewise sometimes `""`, and `location`
    is `null` (not omitted) when unset.
