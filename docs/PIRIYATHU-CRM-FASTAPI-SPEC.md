# Piriyathu CRM FastAPI Specification

## Identity model

- Internal primary key: integer `id` on every table (used for foreign keys).
- Public identifier: string `name` with entity prefix and zero-padded suffix.
- API and UI use public `name` values in URLs, list IDs, and link fields.

## Public ID format

New records use 4-digit suffixes:

| Entity | Prefix | Example |
|--------|--------|---------|
| Product | `PROD-` | `PROD-0001` |
| User Product Access | `UPA-` | `UPA-0001` |
| Organization | `ORG-` | `ORG-0001` |
| Contact | `CONT-` | `CONT-0001` |
| Lead | `LEAD-` | `LEAD-0001` |
| Deal | `DEAL-` | `DEAL-0001` |
| Task | `TASK-` | `TASK-0001` |
| Note | `NOTE-` | `NOTE-0001` |
| Activity | `ACT-` | `ACT-0001` |
| Expense | `EXP-` | `EXP-0001` |
| Client Payment | `PAY-` | `PAY-0001` |
| Comment | `COMM-` | `COMM-0001` |

Legacy imported records may retain 5-digit Frappe codes (for example `DEAL-00001`). These are preserved during migration.

Users do not use a naming series; identity remains `username` / `email`.

## API contract

- Read responses expose:
  - `name`: public identifier
  - `id`: same value as `name` for frontend compatibility
  - `record_id`: same value as `name`
  - `internal_id`: integer PK (optional diagnostic field)
- Create endpoints assign `name` server-side; clients must not supply it.
- Update endpoints must not mutate `name`.
- Read/update/delete endpoints accept either public `name` or legacy numeric id strings during transition.

## Backend modules

- `app/services/naming.py`: prefix registry and ID generation
- `app/services/resolve.py`: record resolution and API formatting
- `app/db_migrations.py`: schema ensure + backfill on startup
- `migration/backfill_public_ids.py`: manual backfill command

## Frontend expectations

- Routes: `/crm/deals/DEAL-0001`
- Link fields store public ids; labels are hydrated separately
- Next.js API proxy maps `name` to canonical `id`

## Entity relationships

### Lead phase (pre-convert)

- A **Lead** owns zero or more **Tasks**, **Notes**, and **Activities** via `lead_id`.
- Child records use `lead_id` with `deal_id` null until conversion.

### Lead convert

`POST /crm/leads/{lead_id}/convert` atomically:

1. Creates **Organization**, **Contact**, and **Deal**
2. Sets `lead.converted = true`, `lead.status = Converted`
3. **Relinks** existing lead Tasks/Notes/Activities to the new Deal (`deal_id` set; `lead_id` retained)
4. Copies missing `organization_id` / `contact_id` onto relinked children

### Deal phase (post-convert)

- A **Deal** owns zero or more **Tasks**, **Notes**, **Activities**, **Expenses**, and **Client Payments** via `deal_id`.
- Each child has at most one `deal_id` (single FK column).

### Validation rules

| Entity | Rule |
|--------|------|
| Task | Must link to at least one of lead, deal, organization, or contact |
| Note | Must link to at least one of lead, deal, organization, or contact |
| Deal | At most one deal per lead (`lead_id` unique when set) |
| Deal | Status `Won` requires at least one client payment |
| Deal | Status `Lost` requires `lost_reason` |
| Deal | Deal value changes require `deal_value_change_reason` |
| Expense | Scope `Deal` requires `deal_id`; scope `Company` must not link a deal |

### Audit trail

Deal updates log assignee, status, and value changes as **Comment** rows (`reference_doctype=Deal`, `reference_name=<deal public id>`). The activity tab reads these comments instead of Frappe `Version` records.
