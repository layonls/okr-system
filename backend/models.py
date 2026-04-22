from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON
from typing import Optional, List, Dict, Any

class Objective(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    type: str # 'global' or 'quarterly'
    owner: Optional[str] = ""
    global_id: Optional[str] = ""
    quarter: Optional[str] = ""

class KeyResult(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    measurement: str
    calculation: Optional[str] = "sum"
    frequency: Optional[str] = "monthly"
    base_value: str
    target_value: str
    global_id: Optional[str] = ""
    quarterly_id: Optional[str] = ""
    Jan: Optional[str] = ""
    Feb: Optional[str] = ""
    Mar: Optional[str] = ""
    Apr: Optional[str] = ""
    May: Optional[str] = ""
    Jun: Optional[str] = ""
    Jul: Optional[str] = ""
    Aug: Optional[str] = ""
    Sep: Optional[str] = ""
    Oct: Optional[str] = ""
    Nov: Optional[str] = ""
    Dec: Optional[str] = ""
    checkins: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
