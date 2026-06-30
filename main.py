from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from datetime import date
from sqlalchemy import create_engine, Column, Integer, String, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import bcrypt
#configurazione del database
DATABASE_URL = "sqlite:///./database.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit = False, autoflush=False, bind=engine)
Base = declarative_base()

#Modelli del database(le tabelle)
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")

class dailyReport(Base):
    __tablename__ = "daily_reports"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) #stiamo collegando la tabella del daily report alla tabella dello user che ha l'id scritto qui
    date = Column(Date, default=date.today)
    activity = Column(String, nullable=False)#il testo di cosa si è fatto durante la giornata, non può essere lasciato vuoto

#crea le tabelle nel file database.db, se non esistono già
Base.metadata.create_all(bind=engine)

#configurazione FASTAPI
app = FastAPI(title="Daily Report API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

class UserCreate(BaseModel):
    name: str
    password: str
    role: str = "user"

class LoginRequest(BaseModel):
    name: str
    password: str

class ReportCreate(BaseModel):
    user_id: int
    activity: str

@app.post("/api/reports")
def create_report(report_data: ReportCreate, db: Session = Depends(get_db)):
    new_report = dailyReport(
        user_id = report_data.user_id,
        activity = report_data.activity,
        date = date.today()
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return {"status": "success", "message": "Attività salvata!"}

@app.get("/api/reports/summary")
def get_weekly_summary(start_date: date, end_date: date, db: Session = Depends(get_db)):
    #questa query prende tutti i report divisi tra le due date
    reports = db.query(dailyReport, User).join(User, dailyReport.user_id == User.id)\
        .filter(dailyReport.date >= start_date, dailyReport.date <= end_date)\
        .all()
    summary = []
    for report, user in reports:
        summary.append({
            "Dipendente": user.name,
            "date": report.date,
            "activity": report.activity
        })
    return summary

@app.post("/api/users")
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.name == user_data.name).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Questo nome utente è già registrato")

    hashed_pwd = hash_password(user_data.password)

    user = User(name=user_data.name, password_hash=hashed_pwd, role=user_data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "name": user.name, "message": "Utente registrato con successo!"}

@app.post("/api/login")
def login(login_data: LoginRequest, db : Session = Depends(get_db)):
    user = db.query(User).filter(User.name == login_data.name).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="nome utente o password errati"
        )
    return{
        "status": "authenticated",
        "user_id": user.id,
        "name": user.name,
        "role": user.role
    }

@app.get("/api/reports/debug")
def get_all_reports_debug(db: Session = Depends(get_db)):
    reports = db.query(dailyReport).all()
    return reports