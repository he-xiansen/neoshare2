from sqlalchemy.orm import Session
from . import models, schemas, auth

# User operations
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        password_hash=hashed_password,
        role=user.role,
        nickname=user.nickname,
        signature=user.signature,
        avatar_url=user.avatar_url
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = auth.get_password_hash(update_data.pop("password"))
        
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False

# File operations
def get_file(db: Session, file_id: int):
    return db.query(models.File).filter(models.File.id == file_id).first()

def get_files(db: Session, path: str = "/", is_public: bool = True, user_id: int = None):
    query = db.query(models.File).filter(models.File.path == path)
    if is_public:
        query = query.filter(models.File.is_public == True)
    elif user_id:
        query = query.filter(models.File.user_id == user_id)
    return query.all()

def create_file(db: Session, file: schemas.FileCreate, user_id: int):
    db_file = models.File(**file.model_dump(), user_id=user_id)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file

def delete_file(db: Session, file_id: int):
    db_file = get_file(db, file_id)
    if db_file:
        db.delete(db_file)
        db.commit()
        return True
    return False

def search_files(db: Session, query: str, is_public: bool, user_id: int = None):
    # 简单的模糊搜索
    sql_query = db.query(models.File).filter(
        models.File.name.ilike(f"%{query}%"),
        models.File.is_public == is_public
    )
    if not is_public and user_id:
        sql_query = sql_query.filter(models.File.user_id == user_id)
    
    return sql_query.all()

def update_file_size(db: Session, file_id: int, size: int):
    db_file = get_file(db, file_id)
    if db_file:
        db_file.size = size
        db.commit()
        db.refresh(db_file)
        return db_file
    return None
