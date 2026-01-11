from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# 默认使用 SQLite，如果环境变量中有 DATABASE_URL 则使用该值
# 注意：如果是 SQLite，connect_args={"check_same_thread": False} 是必须的
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./neoshare.db")

connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
