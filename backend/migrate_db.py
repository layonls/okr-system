import os
import json
from sqlmodel import Session
from database import create_db_and_tables, engine
from models import Objective, KeyResult

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
DB_JSON_FILE = os.path.join(DATA_DIR, "db.json")

def migrate():
    # Cria o sqlite app.db
    create_db_and_tables()

    if not os.path.exists(DB_JSON_FILE):
        print(f"File {DB_JSON_FILE} not found. Nothing to migrate.")
        return

    with open(DB_JSON_FILE, "r") as f:
        data = json.load(f)

    with Session(engine) as session:
        # Check if already migrated
        existing_objs = session.query(Objective).count()
        existing_krs = session.query(KeyResult).count()
        if existing_objs > 0 or existing_krs > 0:
            print("Database already contains data. Migration aborted.")
            return

        obj_ids_seen = set()
        kr_ids_seen = set()

        print(f"Migrating {len(data.get('objectives', []))} objectives...")
        for obj_dict in data.get("objectives", []):
            obj_id = str(obj_dict.get("id"))
            if not obj_id or obj_id in obj_ids_seen:
                continue
            obj_ids_seen.add(obj_id)
            obj = Objective(
                id=obj_id,
                name=obj_dict.get("name"),
                type=obj_dict.get("type"),
                owner=obj_dict.get("owner", ""),
                global_id=obj_dict.get("global_id", ""),
                quarter=obj_dict.get("quarter", "")
            )
            session.add(obj)

        print(f"Migrating {len(data.get('key_results', []))} key results...")
        for kr_dict in data.get("key_results", []):
            kr_id = str(kr_dict.get("id"))
            if not kr_id or kr_id in kr_ids_seen:
                continue
            kr_ids_seen.add(kr_id)
            kr = KeyResult(
                id=kr_id,
                name=kr_dict.get("name"),
                measurement=kr_dict.get("measurement", "increase"),
                base_value=kr_dict.get("base_value", "0"),
                target_value=kr_dict.get("target_value", "0"),
                global_id=kr_dict.get("global_id", ""),
                quarterly_id=kr_dict.get("quarterly_id", ""),
                Jan=kr_dict.get("Jan", ""),
                Feb=kr_dict.get("Feb", ""),
                Mar=kr_dict.get("Mar", ""),
                Apr=kr_dict.get("Apr", ""),
                May=kr_dict.get("May", ""),
                Jun=kr_dict.get("Jun", ""),
                Jul=kr_dict.get("Jul", ""),
                Aug=kr_dict.get("Aug", ""),
                Sep=kr_dict.get("Sep", ""),
                Oct=kr_dict.get("Oct", ""),
                Nov=kr_dict.get("Nov", ""),
                Dec=kr_dict.get("Dec", ""),
                checkins=[]
            )
            session.add(kr)

        session.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
