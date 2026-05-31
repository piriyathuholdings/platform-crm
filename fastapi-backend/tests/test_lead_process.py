import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.models.crm import Deal, Lead, Note, Product, Task
from app.schemas.crm import DealUpdate
from app.services.crm import (
    convert_lead,
    update_deal,
    validate_note_parent,
    validate_task_parent,
)
from app.services.naming import assign_public_id


def _seed_product(session: Session) -> Product:
    product = Product(product_code="P1", product_name="Product 1")
    assign_public_id(session, product)
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def _seed_lead(session: Session, product: Product) -> Lead:
    lead = Lead(
        lead_name="Acme Lead",
        contact_name="Jane Doe",
        product_id=product.id,
        assigned_to="user1",
        status="Open",
    )
    assign_public_id(session, lead)
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


def test_convert_lead_relinks_tasks_and_notes():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        product = _seed_product(session)
        lead = _seed_lead(session, product)

        task = Task(
            title="Follow up",
            product_id=product.id,
            assigned_to="user1",
            lead_id=lead.id,
            status="Open",
        )
        assign_public_id(session, task)
        note = Note(
            title="Lead note",
            product_id=product.id,
            assigned_to="user1",
            lead_id=lead.id,
            content="Initial contact",
        )
        assign_public_id(session, note)
        session.add(task)
        session.add(note)
        session.commit()

        _, _, _, deal = convert_lead(session, lead)

        session.refresh(task)
        session.refresh(note)
        assert task.deal_id == deal.id
        assert task.lead_id == lead.id
        assert note.deal_id == deal.id
        assert note.lead_id == lead.id
        assert lead.converted is True


def test_task_requires_parent_link():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        product = _seed_product(session)
        task = Task(title="Orphan", product_id=product.id, assigned_to="user1")
        errors = validate_task_parent(session, task)
        assert errors


def test_deal_won_requires_payment():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        product = _seed_product(session)
        lead = _seed_lead(session, product)
        _, _, _, deal = convert_lead(session, lead)

        with pytest.raises(ValueError, match="client payment"):
            update_deal(session, deal, DealUpdate(deal_status="Won"))


def test_related_deal_tasks_query_by_deal_id():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        product = _seed_product(session)
        lead = _seed_lead(session, product)
        _, _, _, deal = convert_lead(session, lead)

        orphan = Task(title="Other", product_id=product.id, assigned_to="user1", deal_id=deal.id)
        assign_public_id(session, orphan)
        session.add(orphan)
        session.commit()

        rows = session.exec(select(Task).where(Task.deal_id == deal.id)).all()
        assert len(rows) >= 1
        assert all(row.deal_id == deal.id for row in rows)


def test_note_requires_parent():
    note = Note(title="Detached")
    errors = validate_note_parent(note)
    assert errors
