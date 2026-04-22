import os
from sqlmodel import SQLModel, create_engine, Session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
os.makedirs(DATA_DIR, exist_ok=True)
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{os.path.join(DATA_DIR, sqlite_file_name)}"

engine = create_engine(sqlite_url, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
