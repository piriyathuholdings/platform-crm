import bcrypt
from sqlmodel import Session, create_engine, select

from app.config import settings
from app.models.crm import User

SEED_USERS = [
    {
        "username": "joseph.p.j@icloud.com",
        "email": "joseph.p.j@icloud.com",
        "full_name": "Joseph P J",
        "password": "password",
        "role": "Business Admin",
    },
]


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def seed_user() -> None:
    engine = create_engine(settings.database_url)
    with Session(engine) as session:
        for spec in SEED_USERS:
            statement = select(User).where(
                (User.username == spec["username"]) | (User.email == spec["email"])
            )
            existing = session.exec(statement).first()
            if existing:
                print(f"User already exists: {spec['username']}")
                continue

            user = User(
                username=spec["username"],
                email=spec["email"],
                full_name=spec["full_name"],
                hashed_password=get_password_hash(spec["password"]),
                role=spec["role"],
                is_active=True,
            )
            session.add(user)
            session.commit()
            print(f"User created successfully: {spec['username']} / {spec['password']}")


if __name__ == "__main__":
    seed_user()
