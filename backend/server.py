import os
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from typing import List, Dict, Any

import firebase_admin
from firebase_admin import credentials, auth

from database import create_db_and_tables, get_session
from models import Objective, KeyResult

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Firebase initialization
FIREBASE_CREDENTIALS = os.environ.get("FIREBASE_CREDENTIALS", None)
if FIREBASE_CREDENTIALS and not getattr(firebase_admin, '_apps', None):
    try:
        if os.path.exists(FIREBASE_CREDENTIALS):
            cred = credentials.Certificate(FIREBASE_CREDENTIALS)
        else:
            # Maybe it's a JSON string
            import json
            cred = credentials.Certificate(json.loads(FIREBASE_CREDENTIALS))
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Firebase Init Error: {e}")

async def verify_token(request: Request):
    if not FIREBASE_CREDENTIALS:
        return None # If no credentials provided, bypass for dev/testing
        
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Token missing or invalid")
    token = auth_header.split(' ')[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Token: {str(e)}")

from migrate_db import migrate

@app.on_event("startup")
def on_startup():
    print("Iniciando banco de dados...")
    create_db_and_tables()
    
    from sqlmodel import text
    from database import engine
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE keyresult ADD COLUMN calculation VARCHAR DEFAULT 'sum'"))
            print("Colunas calculation adicionada com sucesso.")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE keyresult ADD COLUMN frequency VARCHAR DEFAULT 'monthly'"))
            print("Colunas frequency adicionada com sucesso.")
        except Exception:
            pass

    print("Verificando necessidade de migração...")
    migrate()

@app.get("/api/data")
def get_data(session: Session = Depends(get_session)):
    objectives = session.exec(select(Objective)).all()
    krs = session.exec(select(KeyResult)).all()
    
    return {
        "objectives": [obj.dict() for obj in objectives],
        "key_results": [kr.dict() for kr in krs]
    }

@app.post("/api/objectives", status_code=201)
def create_objective(obj: Dict[str, Any], session: Session = Depends(get_session), user=Depends(verify_token)):
    # Simple ID generation mimicking previous behavior
    count = session.query(Objective).count()
    new_id = str(count + 1)
    
    new_obj = Objective(
        id=new_id,
        name=obj.get("name"),
        type=obj.get("type"),
        owner=obj.get("owner", ""),
        global_id=obj.get("global_id", ""),
        quarter=obj.get("quarter", "")
    )
    session.add(new_obj)
    session.commit()
    session.refresh(new_obj)
    return new_obj

@app.put("/api/objectives/{obj_id}")
def update_objective(obj_id: str, updates: Dict[str, Any], session: Session = Depends(get_session), user=Depends(verify_token)):
    obj = session.get(Objective, obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Objective not found")
        
    for k, v in updates.items():
        if hasattr(obj, k):
            setattr(obj, k, v)
            
    session.add(obj)
    session.commit()
    return {"status": "success"}

@app.delete("/api/objectives/{obj_id}")
def delete_objective(obj_id: str, session: Session = Depends(get_session), user=Depends(verify_token)):
    obj = session.get(Objective, obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Objective not found")
    
    session.delete(obj)
    
    # Cascading deletes logically matching old code
    krs = session.exec(select(KeyResult).where(
        (KeyResult.global_id == obj_id) | (KeyResult.quarterly_id == obj_id)
    )).all()
    for kr in krs:
        session.delete(kr)
        
    sub_objs = session.exec(select(Objective).where(Objective.global_id == obj_id)).all()
    for so in sub_objs:
        session.delete(so)
        
    session.commit()
    return {"status": "deleted"}

@app.post("/api/krs", status_code=201)
def create_kr(kr_data: Dict[str, Any], session: Session = Depends(get_session), user=Depends(verify_token)):
    count = session.query(KeyResult).count()
    new_id = str(count + 1)
    
    new_kr = KeyResult(
        id=new_id,
        name=kr_data.get("name"),
        measurement=kr_data.get("measurement", "increase"),
        base_value=kr_data.get("base_value", "0"),
        target_value=kr_data.get("target_value", "0"),
        global_id=kr_data.get("global_id", ""),
        quarterly_id=kr_data.get("quarterly_id", ""),
        Jan=kr_data.get("Jan", ""),
        Feb=kr_data.get("Feb", ""),
        Mar=kr_data.get("Mar", ""),
        Apr=kr_data.get("Apr", ""),
        May=kr_data.get("May", ""),
        Jun=kr_data.get("Jun", ""),
        Jul=kr_data.get("Jul", ""),
        Aug=kr_data.get("Aug", ""),
        Sep=kr_data.get("Sep", ""),
        Oct=kr_data.get("Oct", ""),
        Nov=kr_data.get("Nov", ""),
        Dec=kr_data.get("Dec", "")
    )
    session.add(new_kr)
    session.commit()
    session.refresh(new_kr)
    return new_kr

@app.put("/api/krs/{kr_id}")
def update_kr(kr_id: str, updates: Dict[str, Any], session: Session = Depends(get_session), user=Depends(verify_token)):
    kr = session.get(KeyResult, kr_id)
    if not kr:
        raise HTTPException(status_code=404, detail="KeyResult not found")
        
    for k, v in updates.items():
        if hasattr(kr, k):
            setattr(kr, k, v)
            
    if "checkins" in updates:
        kr.checkins = updates['checkins']

    session.add(kr)
    session.commit()
    return {"status": "success"}

@app.delete("/api/krs/{kr_id}")
def delete_kr(kr_id: str, session: Session = Depends(get_session), user=Depends(verify_token)):
    kr = session.get(KeyResult, kr_id)
    if not kr:
        raise HTTPException(status_code=404, detail="KeyResult not found")
        
    session.delete(kr)
    session.commit()
    return {"status": "deleted"}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=80, reload=True)
