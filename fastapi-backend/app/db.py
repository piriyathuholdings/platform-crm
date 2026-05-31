from sqlmodel import SQLModel, create_engine, Session

from app.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    import app.models.crm  # noqa: F401 - register SQLModel metadata

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        from app.db_migrations import backfill_public_ids

        backfill_public_ids(session)


def get_session():
    with Session(engine) as session:
        yield session
