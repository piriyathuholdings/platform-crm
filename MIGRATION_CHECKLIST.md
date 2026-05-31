# Migration Validation and Cutover Checklist

## Pre-Migration Validation

### Frappe Backend Health Check
- [ ] Frappe backend is running at `http://localhost:8000` without errors
- [ ] All three apps installed: `frappe`, `frappe_whatsapp`, `cmate_crm`
- [ ] Bench scheduler and worker processes are running
- [ ] Redis cache and queue are accessible
- [ ] Socket.io server is running at port 9001
- [ ] Database backups are current and tested

### Next.js Frontend Health Check
- [ ] Next.js frontend is running at expected URL
- [ ] All CRM pages load without errors
- [ ] Current API calls to Frappe endpoints work
- [ ] No console errors in browser dev tools

### CRM Data Validation
- [ ] Sample data exists for all main CRM entities (Products, Leads, Deals, Contacts, Organizations)
- [ ] Deal financials are correctly calculated in Frappe
- [ ] Note follow-up tasks are being created correctly
- [ ] User Product Access restricts data correctly per user

## FastAPI Backend Setup

### Project Initialization
- [ ] `fastapi-backend/` directory created with proper structure
- [ ] Python virtual environment `.venv` created and activated
- [ ] All dependencies installed from `requirements.txt`
- [ ] `.env` file configured with secure `JWT_SECRET_KEY`
- [ ] Database initialized (SQLite for dev, MariaDB/PostgreSQL for prod)

### Code Validation
- [ ] All Python files compile without syntax errors
- [ ] SQLModel models defined for all CRM doctypes
- [ ] Pydantic schemas created for request/response validation
- [ ] Service layer implements core CRUD operations
- [ ] Router endpoints are properly structured with dependency injection

### Local Development Test
- [ ] FastAPI server starts on port 9000: `uvicorn app.main:app --reload --port 9000`
- [ ] Swagger API docs accessible at `http://localhost:9000/docs`
- [ ] Health endpoint `/health` returns `{"status": "ok"}`
- [ ] Create a test Lead via POST `/crm/leads` and verify it's saved
- [ ] Retrieve the lead via GET `/crm/leads/{id}` and verify data
- [ ] Update the lead via PUT `/crm/leads/{id}` and verify changes
- [ ] List all leads via GET `/crm/leads` and verify pagination works

## Phase 1: Core CRUD Implementation

### Product Management
- [ ] `GET /crm/products` lists all products
- [ ] `POST /crm/products` creates new product with auto-naming
- [ ] `GET /crm/products/{id}` returns product detail
- [ ] `PUT /crm/products/{id}` updates product fields

### User Product Access
- [ ] `GET /crm/user-product-access` filters by current user
- [ ] `POST /crm/user-product-access` grants product access
- [ ] `DELETE /crm/user-product-access/{id}` revokes access
- [ ] Duplicate active access rows are prevented

### Organizations
- [ ] `GET /crm/organizations` lists filtered by product
- [ ] `POST /crm/organizations` creates with product_id and assigned_to
- [ ] Duplicate organization names within same product are prevented
- [ ] Email/phone fields are normalized (lowercase email, spaces removed from phone)

### Contacts
- [ ] `GET /crm/contacts` lists by product and product_id if accessible
- [ ] `POST /crm/contacts` creates with product-scoped links
- [ ] Contact name, email, mobile are validated and normalized
- [ ] Cross-product contact references are blocked

### Leads
- [ ] `GET /crm/leads` lists with owner/assigned_to row-level filtering
- [ ] `POST /crm/leads` creates with auto-assignment to current user if not set
- [ ] `PUT /crm/leads/{id}` allows status updates
- [ ] `DELETE /crm/leads/{id}` soft-deletes or hard-deletes based on policy
- [ ] Lost leads require `lost_reason` field
- [ ] Duplicate leads by email/mobile within product are prevented

### Deals
- [ ] `GET /crm/deals` lists with product and row-level filtering
- [ ] `POST /crm/deals` creates deal and applies probability based on status
- [ ] `PUT /crm/deals/{id}` updates deal and triggers financial recalculation
- [ ] Won deals require at least one Client Payment
- [ ] Lost deals require lost_reason
- [ ] Changing deal_value requires deal_value_change_reason
- [ ] Cross-product deal references (organization, contact, lead) are blocked

### Tasks
- [ ] `GET /crm/tasks` lists by product and assigned_to
- [ ] `POST /crm/tasks` creates with status and priority defaults
- [ ] `PUT /crm/tasks/{id}` updates status, due_date, etc.
- [ ] Task linked to deal/organization/contact must match product

### Notes
- [ ] `GET /crm/notes` lists by product and owner/assigned_to
- [ ] `POST /crm/notes` creates with optional follow_up automation
- [ ] Follow-up date is auto-computed from follow_up_when preset
- [ ] If `create_follow_up_task` is true, a Task is auto-created
- [ ] `PUT /crm/notes/{id}` updates note fields

### Expenses
- [ ] `GET /crm/expenses` lists by product
- [ ] `POST /crm/expenses` creates with expense_scope validation
- [ ] Company-scoped expenses are restricted to Business Admin only
- [ ] Company expenses cannot link to deals
- [ ] Deal-scoped expenses require a deal_id
- [ ] Creating/updating expense triggers deal financial recalculation

### Client Payments
- [ ] `GET /crm/payments` lists by product (from associated deals)
- [ ] `POST /crm/payments` creates with deal_id and amount
- [ ] Creating/updating payment triggers deal financial recalculation
- [ ] Payment status is validated (Received, Cleared, etc.)

## Phase 2: Business Logic and Automations

### Deal Financial Recalculation
- [ ] Deal's `total_expenses` sums all linked Expense amounts (non-rejected)
- [ ] Deal's `total_payments_received` sums all linked Client Payment amounts (Received/Cleared)
- [ ] Deal's `to_collect` = deal_value - total_payments_received
- [ ] Deal's `payment_summary_status` is set based on payment ratio:
  - `"Unpaid"` if total_payments = 0
  - `"Partially Paid"` if 0 < total_payments < deal_value
  - `"Fully Paid"` if total_payments >= deal_value
- [ ] Financial updates are triggered on Expense, Client Payment, and Deal updates

### Deal Status and Probability
- [ ] Deal probability is auto-mapped from deal_status:
  - Qualification → 10
  - Discovery → 20
  - Demo/Making → 35
  - Proposal/Quotation → 50
  - Negotiation → 70
  - Ready to Close → 90
  - Won → 100
  - Lost → 0
- [ ] Won date is auto-set when deal_status = Won
- [ ] Status change from Won to other status is allowed (permitting re-negotiation)

### Note Follow-up Automation
- [ ] If Note has `follow_up_when` set, `follow_up_date` is computed:
  - "Next Week" → 7 days from today
  - "2 Weeks Later" → 14 days
  - "1 Month Later" → 1 month
  - "2 Months Later" → 2 months
  - "3 Months Later" → 3 months
- [ ] If Note has `create_follow_up_task = true` and `follow_up_date` is set, a Task is auto-created
- [ ] Auto-created Task inherits product, assigned_to, deal, organization, contact from Note
- [ ] Follow-up Task has status "Open", priority "Medium"
- [ ] Existing follow-up task won't be duplicated if one already exists

### Default Assignment
- [ ] New records without `assigned_to` are auto-assigned to the creating user
- [ ] Exception: if user has access to exactly one product, use that product's owner instead (TBD policy)

## Phase 3: Permissions and Row-Level Security

### Role-Based Access
- [ ] Business Admin can create/read/write/delete/export/print/share/report on all CRM records
- [ ] Business User can create/read/write on CRM records but cannot delete/share/report
- [ ] System Manager / Administrator bypass all CRM access checks

### Product-Scoped Access
- [ ] User Product Access defines which products a user can access
- [ ] User can only see/modify records belonging to their accessible products
- [ ] Users with no User Product Access entries cannot access CRM
- [ ] Business Admin can access all products (implied)

### Row-Level Security (Owner/Assignee)
- [ ] Business User can only read/write records where they are:
  - Record owner (creator), OR
  - Record assigned_to value
- [ ] Business Admin can read/write any record in their accessible products
- [ ] DELETE operations are restricted per role (Business User cannot delete)

### User Account Protection
- [ ] Business Admin cannot mutate protected accounts (`Administrator`, `Guest`)
- [ ] Business Admin cannot mutate users who have privileged platform roles (System Manager, etc.)
- [ ] Regular users can only read their own user record

### Cross-Product Link Validation
- [ ] Deal's organization, contact, and lead must all belong to the same product
- [ ] Note's organization, contact, deal, and lead must match the same product
- [ ] Task's organization, contact, and deal must match the same product
- [ ] System prevents linking to records in a different product

## Phase 4: Data Consistency and Validation

### Email and Phone Normalization
- [ ] Email fields are lowercased and trimmed
- [ ] Mobile/phone fields have whitespace removed
- [ ] Normalization applies to Contact, Lead, and Organization

### Duplicate Prevention
- [ ] Duplicate User Product Access is prevented (same user/product/is_active)
- [ ] Duplicate Organization name within product is prevented
- [ ] Duplicate Contact by email or mobile within product is prevented

### Field-Level Validation
- [ ] Lost Lead must have non-empty lost_reason
- [ ] Lost Deal must have non-empty lost_reason
- [ ] Deal value change must have non-empty deal_value_change_reason
- [ ] Won Deal must have at least one Client Payment record

### Expense Validation
- [ ] Company-scoped expense requires Business Admin user
- [ ] Company-scoped expense cannot link to a deal
- [ ] Deal-scoped expense requires a deal_id

## Phase 5: API Standards and Error Handling

### HTTP Status Codes
- [ ] 200 OK for successful GET, PUT, DELETE
- [ ] 201 Created for successful POST
- [ ] 204 No Content for DELETE with no body response
- [ ] 400 Bad Request for validation failures (with error detail)
- [ ] 401 Unauthorized for missing/invalid auth
- [ ] 403 Forbidden for permission denial
- [ ] 404 Not Found for missing resources
- [ ] 409 Conflict for duplicate record attempts
- [ ] 500 Internal Server Error for unhandled exceptions

### Error Response Format
- [ ] All errors return JSON with `{"detail": "error message"}`
- [ ] Validation errors include field-level details if applicable

### Logging
- [ ] All API requests are logged with timestamp, method, path, status
- [ ] All database operations are logged
- [ ] Permission denials are logged with user and resource info

### Pagination
- [ ] List endpoints support `skip` and `limit` query parameters
- [ ] Default `limit` is 100, max is 1000
- [ ] Responses include total count if available

## Integration and Cutover

### Next.js Frontend Integration
- [ ] Update API base URL to point to FastAPI (initially localhost:9000)
- [ ] Test all CRM pages work with new backend
- [ ] Verify user authentication works (JWT tokens or session cookies)
- [ ] Check that permission-based UI elements respect new backend rules

### Nginx Routing Update
- [ ] Add FastAPI upstream to `frappe-bench/config/nginx.conf`:
  ```nginx
  upstream fastapi-backend {
      server 127.0.0.1:9000 fail_timeout=0;
  }
  ```
- [ ] Route `/api/crm/*` paths to FastAPI
- [ ] Keep other paths going to Frappe (port 8000)
- [ ] Test routing works without breaking existing Frappe endpoints

### Gradual Cutover Strategy
- [ ] Start with read-only endpoints (GET) to FastAPI while writes go to Frappe
- [ ] Once reads are stable, switch writes (POST/PUT) to FastAPI
- [ ] Monitor error logs during cutover
- [ ] Keep Frappe running as fallback for at least 2 weeks
- [ ] After all features are verified, decommission Frappe

### Data Sync During Dual-Run
- [ ] If both backends are serving simultaneously:
  - Consider read-only mode on Frappe to prevent conflicts
  - Use a sync service to keep data consistent
  - Document the cutover sequence to avoid data loss

## Production Checklist

### Environment and Deployment
- [ ] FastAPI running under Gunicorn/Uvicorn with proper worker count (4x CPU cores)
- [ ] `.env` configured with production DATABASE_URL (MariaDB or PostgreSQL)
- [ ] JWT_SECRET_KEY is a strong random string (not defaults)
- [ ] Logging is configured to file, not just stdout
- [ ] Database backups are automated and tested
- [ ] Redis for caching/jobs is configured and monitored

### Security
- [ ] HTTPS/TLS is enabled for all API endpoints
- [ ] CORS is configured to allow only Next.js frontend domain
- [ ] Rate limiting is enforced on API endpoints
- [ ] SQL injection prevention via SQLModel parameterized queries
- [ ] CSRF protection if using session-based auth
- [ ] Password hashing uses bcrypt with appropriate cost factor

### Monitoring and Alerting
- [ ] Application logs are monitored for errors
- [ ] Database connection pool is monitored
- [ ] API response times are tracked
- [ ] Alerts are set up for errors, slow queries, and resource exhaustion

### Testing and Validation
- [ ] All CRUD operations pass end-to-end tests
- [ ] Permission and row-level security tests pass
- [ ] Business logic automations (deal financials, note follow-ups) work correctly
- [ ] Load tests show acceptable response times under expected traffic
- [ ] Stress tests show graceful degradation under heavy load

## Sign-Off

- [ ] CRM team has reviewed and approved migration plan
- [ ] QA team has validated all functionality
- [ ] DevOps team has reviewed deployment and monitoring setup
- [ ] Business owner approves go-live date
- [ ] Rollback plan is documented and tested

## Post-Cutover

- [ ] Monitor API error rates for 48 hours
- [ ] Collect user feedback on performance and stability
- [ ] Document any issues and resolutions for future migrations
- [ ] Schedule Frappe decommissioning date (recommend 30 days post-cutover)
- [ ] Archive Frappe database and configuration for compliance/audit
