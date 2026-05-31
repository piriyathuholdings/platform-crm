# Migrating from Frappe to FastAPI

## Overview
This document describes a migration path from the existing Frappe backend to a new FastAPI backend. It includes a detailed look at the `cmate_crm` custom app, the CRM Doctype model, permissions, automations, validations, fields, and table-level migration concerns.

## Current Frappe architecture

### Core setup
- Frappe is deployed under `frappe-bench/` with `bench` and `gunicorn`.
- `frappe-bench/Procfile` runs:
  - `bench serve --port 8000`
  - `bench watch`
  - `bench schedule`
  - `bench worker`
- `frappe-bench/config/supervisor.conf` starts:
  - Gunicorn web worker on `127.0.0.1:8000`
  - `bench schedule`
  - `bench worker`
  - Redis servers for cache and queue
  - Node socket.io server for realtime

### Nginx routing
- `frappe-bench/config/nginx.conf` proxies:
  - `/socket.io` to Node socket.io server on port `9001`
  - all other traffic to Frappe/gunicorn on port `8000`
  - static files from `/assets`
- Two hostnames are mapped:
  - `comms.computemate.com`
  - `frappe.crm.piriyathu.com`

### Site config
- `frappe-bench/sites/common_site_config.json` includes:
  - `default_site: "comms.computemate.com"`
  - `dns_multitenant: true`
  - Redis endpoints for cache/queue/socketio
  - `serve_default_site: false`
  - `socketio_port: 9001`
  - `webserver_port: 8000`

### Installed apps
- `frappe`
- `frappe_whatsapp`
- `cmate_crm`

### Custom app info
- `frappe-bench/apps/cmate_crm/pyproject.toml` defines `cmate_crm`.
- `cmate_crm` uses Frappe hooks in `cmate_crm/cmate_crm/hooks.py`.
- `cmate_crm` ships fixtures for roles, permissions, custom fields, and property setters.
- `frappe-bench/apps/frappe_whatsapp/requirements.txt` contains `python-magic` and the WhatsApp integration app.

## cmate_crm: domain, permissions, automations, validations, fields

### Core CRM doctypes and tables
The custom CRM domain is centered on the following doctypes (tables):

- `Product`
- `User Product Access`
- `Organization`
- `Contact`
- `Lead`
- `Deal`
- `Task`
- `Note`
- `Activity`
- `Expense`
- `Client Payment`

Supporting doctypes referenced by this app:
- `User`
- `Comment`
- `Has Role`
- `Role`
- `Custom Field`
- `Custom DocPerm`
- `Property Setter`

### Object relationships
- `Product` is the primary tenant scope for CRM data.
- `User Product Access` links users to allowed products and controls product-level access.
- `Organization`, `Contact`, `Lead`, and `Deal` are all product-scoped.
- `Note`, `Task`, `Activity`, `Expense`, and `Client Payment` reference core CRM records and update deal financials.
- `Deal` is the primary sales object that links to `Organization`, `Contact`, `Lead`, and `Product`.

### Concrete FastAPI schema mapping
The following schema is a concrete starting point for the FastAPI backend. It maps the CRM domain into explicit SQLModel tables and Pydantic request/response models.

#### CRM table model design
- `Product` is the tenant scope entity.
- `UserProductAccess` defines product-level access and role scope.
- `Organization`, `Contact`, `Lead`, and `Deal` are the core CRM entities.
- `Note`, `Task`, `Expense`, and `ClientPayment` are linked objects that drive workflows and deal financials.
- Fields like `assigned_to`, `product_id`, and `owner` are required to preserve row-level security semantics.

#### Concrete table definitions
Use these models as the migration target for CRM data:

- `Product`
  - `product_code`, `product_name`, `product_type`, `description`, `is_active`
- `UserProductAccess`
  - `user_id`, `product_id`, `role_in_product`, `is_active`
- `Organization`
  - `organization_name`, `product_id`, `assigned_to`, `status`, `industry`, `phone`, `email`, `website`
- `Contact`
  - `full_name`, `product_id`, `organization_id`, `assigned_to`, `status`, `email`, `mobile_no`, `job_title`
- `Lead`
  - `lead_name`, `product_id`, `assigned_to`, `status`, `source`, `email`, `mobile_no`, `organization_id`, `converted`, `lost_reason`
- `Deal`
  - `deal_title`, `product_id`, `assigned_to`, `lead_id`, `organization_id`, `contact_id`, `deal_status`, `probability`, `deal_value`, `total_expenses`, `total_payments_received`, `to_collect`, `payment_summary_status`, `won_date`, `deal_value_change_reason`, `lost_reason`
- `Task`
  - `title`, `product_id`, `assigned_to`, `deal_id`, `organization_id`, `contact_id`, `due_date`, `status`, `priority`
- `Note`
  - `title`, `product_id`, `assigned_to`, `lead_id`, `deal_id`, `organization_id`, `contact_id`, `follow_up_when`, `follow_up_date`, `create_follow_up_task`, `follow_up_task_title`, `follow_up_task`
- `Expense`
  - `expense_title`, `expense_scope`, `assigned_to`, `borne_by`, `expense_date`, `amount`, `deal_id`
- `ClientPayment`
  - `deal_id`, `amount`, `status`, `received_date`

#### Key schema validation contracts
- `deal_status` controls probability and payment requirements.
- `lost_reason` is mandatory when `deal_status` is `Lost`.
- `deal_value_change_reason` is mandatory when `deal_value` changes.
- `ClientPayment` and `Expense` must trigger `Deal` financial recalculation.
- `Note` follow-up fields drive task creation and reminders.

### Naming and identity
`cmate_crm/install.py` defines application naming series via `CRM_SERIES`:

- `Product`: `PROD-.#####`
- `User Product Access`: `UPA-.#####`
- `Organization`: `ORG-.#####`
- `Contact`: `CONT-.#####`
- `Lead`: `LEAD-.#####`
- `Deal`: `DEAL-.#####`
- `Task`: `TASK-.#####`
- `Note`: `NOTE-.#####`
- `Activity`: `ACT-.#####`
- `Expense`: `EXP-.#####`
- `Client Payment`: `PAY-.#####`

The app also installs these series on `after_install` and `after_migrate`.

### Custom fields and schema extensions
`cmate_crm` defines custom fields for `Note` and `Contact` via fixtures.

#### Custom fields on `Note`
The app adds CRM-specific metadata to `Note`:
- `product` (Link to `Product`)
- `assigned_to` (Link to `User`)
- `lead` (Link to `Lead`)
- `deal` (Link to `Deal`)
- `organization` (Link to `Organization`)
- `contact` (Link to `Contact`)
- follow-up specific fields such as `follow_up_when`, `follow_up_date`, `create_follow_up_task`, `follow_up_task_title`, and `follow_up_task`

These fields are used for note-based follow-up automation and context-aware CRM activity tracking.

#### Custom fields on `Contact`
The app extends `Contact` with CRM scoping fields such as:
- `product` (Link to `Product`)
- `organization` and `assigned_to` metadata used by CRM list views and access checks

The actual set of custom fields is defined in `frappe-bench/apps/cmate_crm/cmate_crm/fixtures/custom_field.json`.

#### Property setters
The app includes `Property Setter` fixtures for:
- `Contact` autoiname: `format:CONT-.#####`
- `Contact` track changes: enabled
- `Note` autoiname: `format:NOTE-.#####`
- `Note` track changes: enabled

These should be preserved or migrated as explicit field rules in FastAPI.

### Roles and permission model
`cmate_crm` defines CRM roles and a custom permission contract to enforce business boundaries.

#### Roles created by the app
- `Business Admin`
- `Business User`

These are created during install and set with `desk_access = 0` so they are CRM-only roles.

#### Custom DocPerm fixtures
The app provides custom document permissions for `Business Admin` and `Business User` on the CRM doctypes. Example behavior:
- `Business Admin`: create/read/write/delete/export/print/share/report
- `Business User`: create/read/write, with more restricted delete/share/report behavior

Fixtures are stored in `frappe-bench/apps/cmate_crm/cmate_crm/fixtures/custom_docperm.json`.

#### Permission query conditions and row-level access
In `hooks.py`, the app registers permission query condition functions for each CRM doctype:
- `Product`, `User Product Access`, `Organization`, `Lead`, `Deal`, `Task`, `Note`, `Activity`, `Expense`, `Client Payment`, `User`

Permission query functions are implemented in `cmate_crm/permissions.py` and generally enforce:
- Administrator, System Manager, and Workspace Manager bypass
- Business Admin bypass
- Business User / CRM user access limited to records where they are `owner` or `assigned_to`

The `has_permission` hook is also overridden for CRM doctypes to apply the same owner/assignee logic.

#### User security exceptions
`User` access is specially guarded:
- `Business Admin` can mutate users, except protected accounts like `Administrator`/`Guest`
- Business Admin cannot mutate users who already have privileged platform roles
- Regular users can only read their own user account

This means FastAPI will need a strong policy layer for user mutation and role assignment.

### Business logic automations
`cmate_crm/automations.py` contains the CRM event-driven behavior.
Key automation flows:

- `apply_default_assignment`: assigns `assigned_to` to current user if empty
- `apply_default_product_for_single_access`: sets the doc product automatically when user has access to exactly one product

#### Deal workflow automations
- `apply_deal_probability`: maps deal status to probability
- `validate_won_requires_payment`: won deals require at least one `Client Payment`
- `validate_deal_lost_requires_reason`: lost deals require `lost_reason`
- `validate_deal_value_change_reason`: changing `deal_value` requires a reason
- `set_deal_won_date`: automatically sets `won_date` when a deal becomes Won
- `recalculate_deal_financials`: updates `total_expenses`, `total_payments_received`, `to_collect`, and `payment_summary_status`
- `log_deal_key_changes`: logs assignment/status/value changes as `Comment`

These automations are triggered by Frappe hooks on `Deal`, `Expense`, `Client Payment`, and related doctypes.

#### Note workflow automations
- `apply_note_follow_up_date`: computes follow-up date based on `follow_up_when`
- `create_follow_up_task_from_note`: creates a `Task` when a note requests a follow-up

### Validation rules
`cmate_crm/validations.py` and `cmate_crm/crm_utils.py` enforce business constraints.

#### Data normalization
- `normalize_contact_fields`: trims and normalizes email/mobile fields for `Contact`, `Lead`, and `Organization`

#### Product and link validation
- `validate_product_access`: denies records whose `product` is not accessible to the current user
- `validate_cross_product_links`: ensures `Organization`, `Contact`, and `Deal` references belong to the same `Product`

#### Duplicate and required field validation
- `validate_unique_user_product_access`: prevents duplicate active product access rows for the same user/product
- `validate_duplicate_organization`: prevents duplicate organizations with the same name in the same product
- `validate_duplicate_contact`: prevents duplicate contacts by email or mobile number within a product
- `validate_lead_lost_requires_reason`: prevents lost leads without a reason
- `validate_company_expense_admin_only`: requires company-scoped expenses to be created by Business Admin and disallows company expenses from linking to deals
- `validate_expense_scope_requirements`: requires a deal for deal-scoped expenses

#### User security validations
- `validate_business_admin_user_mutation`: denies forbidden user account updates
- `validate_business_admin_role_assignment`: denies role assignment/removal for protected accounts and restricted targets

### Hooks and hook lifecycle
`cmate_crm/hooks.py` wires Frappe event hooks and fixtures:
- `after_install = cmate_crm.install.after_install`
- `after_migrate = cmate_crm.install.after_migrate`
- `doc_events` for `validate`, `on_update`, and `on_trash`
- `before_request` and `auth_hooks` to enforce channel security
- `permission_query_conditions`, `has_permission` overrides for CRM tables

`install.py` handles application bootstrap:
- creates `Business Admin` and `Business User` roles
- preserves legacy CRM roles if present
- initializes naming series
- calls `setup_full_crm()` to create required CRM metadata and records

### Sample data and business assumptions
`demo_data.py` reveals sample fields and CRM usage patterns used by the app:
- product metadata: `product_code`, `product_name`, `product_type`, `is_active`, `description`
- organization metadata: `organization_name`, `status`, `industry`, `phone`, `email`, `website`
- contact metadata: `full_name`, `product`, `organization`, `assigned_to`, `status`, `email`, `mobile_no`, `job_title`
- lead metadata: `lead_name`, `status`, `source`, `email`, `mobile_no`, `organization`
- deal metadata: `deal_title`, `deal_status`, `probability`, `deal_value`, `total_expenses`, `total_payments_received`, `to_collect`, `payment_summary_status`

This file is a useful migration reference for expected field coverage and sample business data.

## Migration implications for FastAPI

### Data model mapping
- Model the CRM doctypes as first-class tables in FastAPI.
- Preserve the product scoping model: `Product` and `User Product Access` are central for access control.
- Use explicit foreign key relationships for `Organization`, `Contact`, `Lead`, `Deal`, `Task`, `Note`, `Expense`, and `Client Payment`.
- Keep `assigned_to` and `owner` fields for row-level security semantics.
- Preserve auto-name/series behavior if you want a 1:1 compatibility with existing record IDs.

### Permissions and row-level security
The migration must preserve these rules:
- `Business Admin` and platform super roles bypass row restrictions.
- CRM users may only access records where they are owner or assignee.
- `User Product Access` defines a user’s allowed products.
- `Organization`, `Contact`, `Deal`, and related records must match the same product.
- `User` record mutation is restricted for protected and privileged accounts.

In FastAPI, implement a dedicated permission service and apply it in each endpoint or via dependency injection.

### Business logic and validation mapping
Convert Frappe validation hooks into explicit business service checks:
- default assignment and default product application
- deal status/probability/payment validation
- lost reason / value-change reason enforcement
- cross-product link validation
- expense scope validation
- follow-up note task creation

Avoid relying on Frappe’s generic `validate` hook model; instead use service-first validation functions consistently.

### Event-driven automations
- Replace Frappe `validate`/`on_update` hooks with domain service hooks inside the FastAPI persistence layer.
- Consider using an application event bus or service layer callbacks to mimic Frappe’s hook lifecycle.
- Keep `recalculate_deal_financials` as an explicit update rule whenever related `Expense`, `Client Payment`, or `Deal` records change.

### Field-level migration notes
From the app code and fixtures, key fields to migrate include:
- `product`, `assigned_to`, `organization`, `contact`, `lead`, `deal` on notes and CRM objects
- follow-up scheduling fields on `Note`
- `deal_value_change_reason`, `lost_reason`, `won_date`, `payment_summary_status`, `total_expenses`, `total_payments_received`, `to_collect`
- `role_in_product` on `User Product Access`

If you preserve the Frappe schema, map these fields directly. If you redesign the schema, ensure equivalent business semantics remain intact.

### Logging and comments
- `log_assignment_change` and `log_deal_key_changes` append CRM comments on record updates.
- If the frontend depends on change history, preserve comment logging or audit tables.

## WhatsApp integration note
The workspace also contains `frappe_whatsapp`, which defines its own WhatsApp-related doctypes and API flows.
- If your migration includes WhatsApp messaging, inspect `frappe-bench/apps/frappe_whatsapp/frappe_whatsapp/doctype/`.
- The current migration document focuses on the CRM domain; treat WhatsApp as a separate integration service if needed.

## Migration strategy recap

### Phase 0: Discovery
- Record all CRM doctypes, custom fields, and site-specific metadata.
- Add a table inventory for `Product`, `Organization`, `Contact`, `Lead`, `Deal`, `Task`, `Note`, `Expense`, and `Client Payment`.
- Identify whether any frontend Next.js pages rely on Frappe-specific list views or meta APIs.

### Phase 1: FastAPI skeleton
- Create a FastAPI service with consistent modules for models, schemas, services, permissions, and routers.
- Add a role and permission service for `Business User` / `Business Admin` behaviors.
- Implement `Product` and `User Product Access` first to establish access control.

### Phase 2: Core CRM workflow
- Port `Lead`, `Deal`, `Organization`, and `Contact` logic first.
- Add validation services for duplicate checks, cross-product links, and lead/deal rules.
- Add automation services for deal probability, deal payment requirements, and note follow-ups.
- Keep Frappe running for any remaining record types until the API is stable.

### Phase 3: Additional CRM entities
- Add `Task`, `Note`, `Activity`, `Expense`, `Client Payment`.
- Implement deal financial recalculation and follow-up task automation.
- Add `Comment` or event logging support if required.

### Phase 4: Cutover and cleanup
- Route Next.js API calls to FastAPI incrementally.
- Transition data writes and reads one domain at a time.
- Remove Frappe-side fixtures only after the new backend fully supports the CRM business rules.

## Appendix: key files and metadata sources
- `frappe-bench/Procfile`
- `frappe-bench/config/nginx.conf`
- `frappe-bench/config/supervisor.conf`
- `frappe-bench/sites/common_site_config.json`
- `frappe-bench/apps/cmate_crm/cmate_crm/hooks.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/install.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/permissions.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/automations.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/validations.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/crm_utils.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/api.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/demo_data.py`
- `frappe-bench/apps/cmate_crm/cmate_crm/fixtures/custom_field.json`
- `frappe-bench/apps/cmate_crm/cmate_crm/fixtures/custom_docperm.json`
- `frappe-bench/apps/cmate_crm/cmate_crm/fixtures/property_setter.json`
- `frappe-bench/apps/cmate_crm/cmate_crm/fixtures/role.json`
- `frappe-bench/apps/frappe_whatsapp/requirements.txt`
- `frappe-bench/sites/apps.txt`
