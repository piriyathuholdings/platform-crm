from fastapi import FastAPI

from app.config import settings
from app.db import init_db
from app.routers.auth import router as auth_router
from app.routers.crm import router as crm_router
from app.routers.frappe_compat import router as frappe_compat_router

init_db()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="FastAPI CRM backend for the Frappe migration project",
)

app.include_router(auth_router, tags=["auth"])
app.include_router(crm_router, prefix="/crm", tags=["crm"])
app.include_router(frappe_compat_router)


@app.get("/health", summary="Service health check")
def health_check() -> dict:
    return {"status": "ok", "environment": settings.environment}
