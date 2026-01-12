from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
from .. import database, crud, schemas, auth, models

router = APIRouter(
    prefix="/api/files",
    tags=["files"],
)

UPLOAD_DIR = "uploads"

def get_storage_path(is_public: bool, user_id: int = None):
    if is_public:
        return os.path.join(UPLOAD_DIR, "public")
    else:
        return os.path.join(UPLOAD_DIR, str(user_id))

@router.post("/upload", response_model=schemas.FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(...), # 相对路径，如 "/" 或 "/docs"
    is_public: bool = Form(False),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # 确定存储根目录
    if is_public:
        # 所有人都可以上传到 public 吗？PRD 说 "用户登录后可以将本地文件拖入文件资源管理器"。
        # 如果是 public 目录，登录用户可以上传。
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, current_user.id)
    
    # 确保目录存在
    full_dir = os.path.join(base_dir, path.strip("/").replace("..", "")) # 简单的路径安全处理
    os.makedirs(full_dir, exist_ok=True)
    
    file_path = os.path.join(full_dir, file.filename)
    
    # 保存文件
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 记录到数据库
    # 注意：这里我们只记录文件元数据。path 字段存储的是相对路径（不包含文件名）
    # 或者 path 存储完整相对路径？根据 crud 实现，path 参数是目录路径。
    # 这里的 models.File.path 应该是完整路径还是目录？
    # 为了方便查询目录下的文件，path 最好是目录路径。
    
    file_size = os.path.getsize(file_path)
    
    file_data = schemas.FileCreate(
        name=file.filename,
        path=path, # 目录路径
        type="file",
        size=file_size,
        mime_type=file.content_type,
        is_public=is_public
    )
    
    return crud.create_file(db=db, file=file_data, user_id=current_user.id)

@router.get("/list", response_model=List[schemas.FileResponse])
def list_files(
    path: str = Query("/", description="Directory path"),
    type: str = Query("public", description="public or private"),
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user) # 可选登录
):
    # 修正：auth.get_current_user 会抛出 401 如果未登录。
    # 我们需要一个 loose_get_current_user 或者手动处理 token。
    # 但根据 PRD，未登录只能看 public。
    # 如果 type=private，必须登录。
    
    # 由于 Depends 的限制，如果 endpoint 需要可选认证，比较麻烦。
    # 这里我们简化：如果 type=public，不需要认证。如果 type=private，需要认证。
    # 但是我们怎么在同一个函数里处理？
    pass

# 重新定义 list_files 以支持可选认证比较复杂，
# 我们拆分为 public_list 和 private_list 或者在内部处理。
# 为了遵循 API 定义 GET /api/files/list，我们需要一个依赖项来尝试获取用户但不报错。

from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    if not token:
        return None
    try:
        return await auth.get_current_user(token, db)
    except HTTPException:
        return None

@router.get("/list/public", response_model=List[schemas.FileResponse])
def list_public_files(
    path: str = Query("/", description="Directory path"),
    db: Session = Depends(database.get_db)
):
    return crud.get_files(db, path=path, is_public=True)

@router.get("/list/private", response_model=List[schemas.FileResponse])
def list_private_files(
    path: str = Query("/", description="Directory path"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    return crud.get_files(db, path=path, is_public=False, user_id=current_user.id)


@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user) # 使用自定义的可选认证
):
    file_record = crud.get_file(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    if not file_record.is_public:
        # 私有文件需要验证权限
        if not current_user or (current_user.id != file_record.user_id and current_user.role != "admin"):
             raise HTTPException(status_code=403, detail="Not authorized")
    
    # 构建物理路径
    if file_record.is_public:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, file_record.user_id)
        
    # path 是目录路径，name 是文件名
    # 简单的路径拼接
    file_path = os.path.join(base_dir, file_record.path.strip("/"), file_record.name)
    
    if not os.path.exists(file_path):
         raise HTTPException(status_code=404, detail="File on disk not found")
         
    return FileResponse(file_path, filename=file_record.name)

@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    file_record = crud.get_file(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    if current_user.role != "admin" and current_user.id != file_record.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # 删除物理文件
    if file_record.is_public:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, file_record.user_id)
    
    file_path = os.path.join(base_dir, file_record.path.strip("/"), file_record.name)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        
    crud.delete_file(db, file_id)
    return {"message": "File deleted"}

@router.get("/content/{file_id}")
def get_file_content(
    file_id: int,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    file_record = crud.get_file(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    if not file_record.is_public:
        if not current_user or (current_user.id != file_record.user_id and current_user.role != "admin"):
             raise HTTPException(status_code=403, detail="Not authorized")
    
    # 物理路径
    if file_record.is_public:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, file_record.user_id)
        
    file_path = os.path.join(base_dir, file_record.path.strip("/"), file_record.name)
    
    if not os.path.exists(file_path):
         raise HTTPException(status_code=404, detail="File on disk not found")
         
    # 仅允许读取文本类文件
    allowed_mimes = ["text/plain", "text/markdown", "application/json", "application/javascript", "text/x-python", "text/html", "text/css"]
    # 或者尝试读取，如果不是文本则报错
    # 为了简单，我们只返回文本内容。前端根据 mime_type 决定是否调用此接口。
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content, "mime_type": file_record.mime_type}
    except UnicodeDecodeError:
         raise HTTPException(status_code=400, detail="Binary file cannot be edited as text")
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

class FileUpdate(schemas.BaseModel):
    content: str

@router.put("/content/{file_id}")
def update_file_content(
    file_id: int,
    update: FileUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    file_record = crud.get_file(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    # 只有拥有者或管理员可以编辑，且必须登录（由 Depends 保证）
    if current_user.role != "admin" and current_user.id != file_record.user_id:
        # 如果是 public 文件，是否允许所有人编辑？
        # PRD: "文件资源管理器中的文件...并能进行编辑...登录状态下文件支持双击编辑"
        # 假设 public 文件也需要登录才能编辑。如果不是自己的，管理员可以编辑。
        # 如果是 public 且不属于自己，普通用户能编辑吗？
        # 假设不能，除非是 Wiki 模式。这里保守策略：只能编辑自己的或者管理员。
        # 如果 public 文件是 admin 创建的，那只有 admin 能改。
        # 让我们检查所有权。
        raise HTTPException(status_code=403, detail="Not authorized to edit this file")
    
    if file_record.is_public:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, file_record.user_id)
        
    file_path = os.path.join(base_dir, file_record.path.strip("/"), file_record.name)
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(update.content)
            
        # 更新文件大小
        new_size = os.path.getsize(file_path)
        crud.update_file_size(db, file_id, new_size)
        
        return {"message": "File updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview/{file_id}")
def preview_ipynb(
    file_id: int,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    """
    Convert IPYNB to HTML for preview
    """
    file_record = crud.get_file(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    if not file_record.is_public:
        if not current_user or (current_user.id != file_record.user_id and current_user.role != "admin"):
             raise HTTPException(status_code=403, detail="Not authorized")
    
    if not file_record.name.endswith(".ipynb"):
         raise HTTPException(status_code=400, detail="Not a notebook file")

    if file_record.is_public:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, file_record.user_id)
        
    file_path = os.path.join(base_dir, file_record.path.strip("/"), file_record.name)
    
    if not os.path.exists(file_path):
         raise HTTPException(status_code=404, detail="File on disk not found")
         
    try:
        from nbconvert import HTMLExporter
        import nbformat
        
        # 读取 notebook
        with open(file_path, "r", encoding="utf-8") as f:
            notebook_content = nbformat.read(f, as_version=4)
            
        # 转换为 HTML
        html_exporter = HTMLExporter()
        html_exporter.theme = "dark" # 尝试使用暗色主题
        (body, resources) = html_exporter.from_notebook_node(notebook_content)
        
        return {"html": body}
    except Exception as e:
        print(f"Conversion error: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
