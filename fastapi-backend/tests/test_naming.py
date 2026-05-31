from sqlmodel import Session, SQLModel, create_engine

from app.models.crm import Deal, Note, Product
from app.services.naming import assign_public_id, generate_public_id, parse_suffix
from app.services.resolve import resolve_record


def test_parse_suffix_supports_four_and_five_digit_codes():
    assert parse_suffix("DEAL-0001", "DEAL-") == 1
    assert parse_suffix("DEAL-00001", "DEAL-") == 1


def test_generate_public_id_is_sequential_per_model():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        first = Product(product_code="P1", product_name="Product 1")
        assign_public_id(session, first)
        session.add(first)
        session.commit()

        second = Product(product_code="P2", product_name="Product 2")
        assign_public_id(session, second)
        session.add(second)
        session.commit()

        assert first.name == "PROD-0001"
        assert second.name == "PROD-0002"


def test_note_public_id_format():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        product = Product(product_code="P1", product_name="Product 1", name="PROD-0001")
        session.add(product)
        session.commit()
        session.refresh(product)

        note = Note(title="Test note", product_id=product.id, content="Hello", lead_id=None)
        assign_public_id(session, note)
        session.add(note)
        session.commit()
        session.refresh(note)

        assert note.name == "NOTE-0001"
        assert note.name.startswith("NOTE-")


def test_resolve_record_by_public_name_or_legacy_numeric_id():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        product = Product(product_code="P1", product_name="Product 1", name="PROD-0001")
        session.add(product)
        session.commit()
        session.refresh(product)

        deal = Deal(deal_title="Test Deal", product_id=product.id, name="DEAL-0042")
        session.add(deal)
        session.commit()
        session.refresh(deal)

        by_name = resolve_record(session, Deal, "DEAL-0042")
        by_numeric = resolve_record(session, Deal, str(deal.id))
        assert by_name is not None
        assert by_numeric is not None
        assert by_name.id == deal.id
        assert by_numeric.id == deal.id
