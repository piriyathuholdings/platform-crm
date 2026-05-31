# FastAPI Backend Setup and Development Guide

## Quick Start

### 1. Create virtual environment
```bash
cd fastapi-backend
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env and set JWT_SECRET_KEY to a secure random value
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Run migrations (create database)
```bash
python3 -c "from app.db import init_db; init_db()"
```

### 5. Start development server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
```

The API will be available at `http://localhost:9000`
Swagger docs at `http://localhost:9000/docs`

## Project Structure

```
fastapi-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entrypoint
│   ├── config.py            # Environment configuration
│   ├── db.py                # Database setup
│   ├── auth.py              # JWT and password utilities
│   ├── models/
│   │   ├── __init__.py
│   │   └── crm.py           # SQLModel CRM entity definitions
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── crm.py           # Pydantic request/response schemas
│   ├── services/
│   │   ├── __init__.py
│   │   └── crm.py           # Business logic and persistence
│   └── routers/
│       ├── __init__.py
│       └── crm.py           # REST API endpoints
├── pyproject.toml
├── requirements.txt
├── .env.example
├── README.md
└── SETUP.md (this file)
```

## CRM Entities and Endpoints

### Product Management
- `GET /crm/products` - List all products
- `POST /crm/products` - Create product
- `GET /crm/products/{id}` - Get product detail
- `PUT /crm/products/{id}` - Update product

### User Product Access
- `GET /crm/user-product-access` - List user's product access
- `POST /crm/user-product-access` - Grant product access
- `DELETE /crm/user-product-access/{id}` - Revoke access

### Organizations
- `GET /crm/organizations` - List organizations
- `POST /crm/organizations` - Create organization
- `GET /crm/organizations/{id}` - Get organization detail
- `PUT /crm/organizations/{id}` - Update organization

### Contacts
- `GET /crm/contacts` - List contacts
- `POST /crm/contacts` - Create contact
- `GET /crm/contacts/{id}` - Get contact detail
- `PUT /crm/contacts/{id}` - Update contact

### Leads
- `GET /crm/leads` - List leads
- `POST /crm/leads` - Create lead
- `GET /crm/leads/{id}` - Get lead detail
- `PUT /crm/leads/{id}` - Update lead
- `DELETE /crm/leads/{id}` - Delete lead

### Deals
- `GET /crm/deals` - List deals
- `POST /crm/deals` - Create deal
- `GET /crm/deals/{id}` - Get deal detail
- `PUT /crm/deals/{id}` - Update deal (triggers financials recalc)

### Tasks
- `GET /crm/tasks` - List tasks
- `POST /crm/tasks` - Create task
- `GET /crm/tasks/{id}` - Get task detail
- `PUT /crm/tasks/{id}` - Update task

### Notes
- `GET /crm/notes` - List notes
- `POST /crm/notes` - Create note (may auto-create follow-up task)
- `GET /crm/notes/{id}` - Get note detail
- `PUT /crm/notes/{id}` - Update note

### Expenses
- `GET /crm/expenses` - List expenses
- `POST /crm/expenses` - Create expense (triggers deal financials)
- `GET /crm/expenses/{id}` - Get expense detail

### Client Payments
- `GET /crm/payments` - List payments
- `POST /crm/payments` - Create payment (triggers deal financials)
- `GET /crm/payments/{id}` - Get payment detail

## Key Features to Implement

### Phase 1: Core CRUD (✓ Scaffold complete)
- [x] Product and User Product Access
- [ ] Organization CRUD
- [ ] Contact CRUD
- [ ] Lead CRUD
- [ ] Deal CRUD
- [ ] Task CRUD
- [ ] Note CRUD
- [ ] Expense CRUD
- [ ] Client Payment CRUD

### Phase 2: Business Logic
- [ ] Deal probability mapping by status
- [ ] Deal financial recalculation (expenses + payments = to_collect)
- [ ] Note follow-up task automation
- [ ] Lost reason and value-change reason validation
- [ ] Payment requirement validation for won deals

### Phase 3: Permissions and Security
- [ ] Role-based access control (Business Admin, Business User)
- [ ] Row-level security (owner/assigned_to checks)
- [ ] Product-scoped access via User Product Access
- [ ] User account mutation restrictions

### Phase 4: API Standards
- [ ] Error handling and custom exceptions
- [ ] Request/response logging
- [ ] Rate limiting
- [ ] API versioning
- [ ] Pagination for list endpoints

## Development Workflow

### Adding a new CRM endpoint

1. **Define the model** in `app/models/crm.py` (SQLModel)
2. **Create schemas** in `app/schemas/crm.py` (Pydantic)
3. **Add service methods** in `app/services/crm.py` (business logic)
4. **Create router** in `app/routers/crm.py` or new file
5. **Register router** in `app/main.py`
6. **Test in FastAPI docs** at `/docs`

### Example: Add Deal endpoint

```python
# In app/routers/crm.py
@router.post("/deals", response_model=DealRead, status_code=status.HTTP_201_CREATED)
def create_deal(*, session: Session = Depends(get_session), deal_in: DealCreate):
    # Validate: won deals require payment
    # Validate: lost deals require lost_reason
    # Default: assign deal_status probability
    return create_deal_service(session, deal_in)
```

## Database

### Using SQLite (development)
The `.env.example` uses `sqlite:///./dev.db` which is fine for local work.

### Migrating to MariaDB/PostgreSQL (production)
Update `DATABASE_URL` in `.env`:
```bash
# MariaDB
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/crm_db

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/crm_db
```

Then run migrations:
```bash
python3 -c "from app.db import init_db; init_db()"
```

## Testing

Run unit tests (create `tests/` directory with pytest):
```bash
pytest tests/ -v
```

## Deployment

### Local parallel development
```bash
# Terminal 1: Keep Frappe running
cd frappe-bench
bench serve

# Terminal 2: Run FastAPI
cd fastapi-backend
source .venv/bin/activate
uvicorn app.main:app --port 9000
```

### Nginx routing (production)
Update `frappe-bench/config/nginx.conf` to route API paths:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:9000;
}

location / {
    proxy_pass http://127.0.0.1:8000;  # Frappe
}
```

Then update Next.js API base URL:
```javascript
// In piriyathu-crm-next
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
```

## Migration Checklist

- [ ] FastAPI backend runs successfully on port 9000
- [ ] All CRM CRUD endpoints are implemented
- [ ] Permissions and row-level security are enforced
- [ ] Business validations match Frappe behavior
- [ ] Deal financial recalculation works correctly
- [ ] Note follow-up automation works
- [ ] All tests pass
- [ ] API documentation is complete
- [ ] Next.js frontend API calls updated to FastAPI
- [ ] Frappe can be safely decommissioned

## Troubleshooting

### Database lock errors
If using SQLite in concurrent development, switch to PostgreSQL or use WAL mode:
```python
# In app/db.py
connect_args = {"timeout": 10, "check_same_thread": False}
```

### Foreign key constraint errors
Ensure related records exist before creating dependent records:
```python
# Create Organization before creating Deal referencing it
org = create_organization(session, org_data)
deal = create_deal(session, {"organization_id": org.id, ...})
```

### Missing environment variables
Ensure `.env` file is present and readable:
```bash
cat .env
```

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
- Migration guide: `../MIGRATE_FRAPPE_TO_FASTAPI.md`
