from .database import engine, Base, SessionLocal
from . import models, auth

def init_db():
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # 检查是否已存在管理员
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        print("Creating admin user...")
        hashed_password = auth.get_password_hash("admin123")
        admin_user = models.User(
            username="admin",
            password_hash=hashed_password,
            role="admin",
            nickname="Administrator",
            signature="System Administrator"
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created (username: admin, password: admin123)")
    else:
        print("Admin user already exists.")
        
    db.close()

if __name__ == "__main__":
    init_db()
