# Virtuagym Public API v1 — documentation discrepancies and undocumented behavior

Findings from building and live-testing a typed client
([@golddevelopment/virtuagym-node](https://github.com/gold-development/virtuagym-node))
against the documented Employee, Member, Club Events, Membership Instance and
Membership Definition resources. Every item below was verified against the
live API (July 2026) unless marked "docs-internal inconsistency".

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

---

*Method note: everything above was reproduced with plain GET/PUT/POST requests
against `https://api.virtuagym.com/api/v1` using api_key + club_secret
authentication on a single club (550 members, 1,073 membership instances, 145
membership definitions). Items 1–6 come from full pagination walks comparing
row counts and unique-ID counts.*
