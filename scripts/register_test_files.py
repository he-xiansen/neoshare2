from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models
import os

def register_public_files():
    db = SessionLocal()
    public_dir = os.path.join("uploads", "public")
    
    # 获取默认管理员用户作为所有者
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        print("Error: Admin user not found")
        return

    files_to_register = [
        ("sample.txt", "text/plain", 1024), # 估算大小
        ("readme.md", "text/markdown", 1024),
        ("script.py", "text/x-python", 1024),
        ("config.json", "application/json", 1024),
        ("app.js", "application/javascript", 1024)
    ]

    for filename, mime_type, _ in files_to_register:
        file_path = os.path.join(public_dir, filename)
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            
            # 检查文件是否已存在
            existing = db.query(models.File).filter(
                models.File.name == filename,
                models.File.is_public == True
            ).first()
            
            if not existing:
                new_file = models.File(
                    name=filename,
                    path="/", # 根目录
                    type="file",
                    size=size,
                    mime_type=mime_type,
                    is_public=True,
                    user_id=admin.id
                )
                db.add(new_file)
                print(f"Registered: {filename}")
            else:
                print(f"Skipped (already exists): {filename}")
    
    db.commit()
    db.close()

if __name__ == "__main__":
    register_public_files()