from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
from .. import database, crud, schemas, auth, models

from fastapi.security import OAuth2PasswordBearer

router = APIRouter(
    prefix="/api/files",
    tags=["files"],
)

UPLOAD_DIR = "uploads"

oauth2_scheme = auth.oauth2_scheme
# 定义一个可选的认证方案，允许未登录访问
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(database.get_db)):
    if not token:
        return None
    try:
        return await auth.get_current_user(token, db)
    except HTTPException:
        return None

def get_storage_path(is_public: bool, user_id: int = None):
    if is_public:
        return os.path.join(UPLOAD_DIR, "public")
    else:
        return os.path.join(UPLOAD_DIR, str(user_id))

@router.post("/upload", response_model=schemas.FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(...), # 目标目录路径，如 "/" 或 "/docs"
    is_public: str = Form(...), # "true" or "false"
    db: Session = Depends(database.get_db),
    token: Optional[str] = Depends(oauth2_scheme)
):
    # 手动获取 user
    current_user = None
    if token:
        try:
            current_user = await auth.get_current_user(token, db)
        except Exception:
            pass

    is_public_bool = is_public.lower() == "true"
    
    # 强制要求登录才能上传（无论是 public 还是 private）
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required for upload")
        
    user_id = current_user.id
    
    if is_public_bool:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, user_id)
        
    # 处理目标路径，确保它存在于 DB 中
    # path 是类似于 "/A/B" 的字符串
    target_dir_path = path.strip("/").replace("..", "")
    if target_dir_path == "":
        full_dir = base_dir
    else:
        full_dir = os.path.join(base_dir, target_dir_path)
    
    # 递归创建 DB 目录记录
    parts = target_dir_path.split("/")
    current_check_path = ""
    for part in parts:
        if not part: continue
        current_check_path = f"{current_check_path}/{part}"
        
        # 检查 DB 是否存在该目录
        query = db.query(models.File).filter(
            models.File.path == (os.path.dirname(current_check_path).replace("\\", "/") if os.path.dirname(current_check_path) != "/" else "/"),
            models.File.name == part,
            models.File.type == "directory",
            models.File.is_public == is_public_bool
        )
        if not is_public_bool:
            query = query.filter(models.File.user_id == user_id)
            
        existing_dir = query.first()
        
        if not existing_dir:
            # 创建 DB 记录
            # parent_path = os.path.dirname(current_check_path)
            # if parent_path == "/": path = "/" else path = parent_path
            p_path = os.path.dirname(current_check_path).replace("\\", "/")
            if p_path == "/" or p_path == "":
                p_path = "/"
                
            new_dir_data = schemas.FileCreate(
                name=part,
                path=p_path,
                type="directory",
                size=0,
                mime_type=None,
                is_public=is_public_bool
            )
            crud.create_file(db, new_dir_data, user_id)
            
    # 确保物理目录存在
    os.makedirs(full_dir, exist_ok=True)
    
    file_path = os.path.join(full_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(file_path)
    mime_type = file.content_type
    
    db_path = "/" + target_dir_path if target_dir_path else "/"
    
    file_data = schemas.FileCreate(
        name=file.filename,
        path=db_path,
        type="file",
        size=file_size,
        mime_type=mime_type,
        is_public=is_public_bool
    )
    
    return crud.create_file(db=db, file=file_data, user_id=user_id)

class DirectoryCreate(schemas.BaseModel):
    name: str
    path: str
    is_public: bool = False

@router.post("/directory", response_model=schemas.FileResponse)
def create_directory(
    dir_data: DirectoryCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # 确定存储根目录
    if dir_data.is_public:
        base_dir = get_storage_path(True)
    else:
        base_dir = get_storage_path(False, current_user.id)
        
    # 确保父目录存在
    # path 是父目录路径
    parent_dir = os.path.join(base_dir, dir_data.path.strip("/").replace("..", ""))
    os.makedirs(parent_dir, exist_ok=True)
    
    # 创建新目录
    new_dir_path = os.path.join(parent_dir, dir_data.name)
    try:
        os.makedirs(new_dir_path, exist_ok=True)
    except OSError as e:
        raise HTTPException(status_code=400, detail=f"Failed to create directory: {e}")
        
    # 检查是否已存在同名记录
    # 这里简单处理，实际上应该检查 DB
    
    file_data = schemas.FileCreate(
        name=dir_data.name,
        path=dir_data.path,
        type="directory",
        size=0,
        mime_type=None,
        is_public=dir_data.is_public
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

# 辅助函数：计算目录大小
def calculate_directory_size(path: str):
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            # 忽略隐藏目录，阻止 os.walk 进入
            dirnames[:] = [d for d in dirnames if not d.startswith('.')]
            
            for f in filenames:
                # 忽略隐藏文件
                if f.startswith('.'):
                    continue
                    
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total_size += os.path.getsize(fp)
    except OSError:
        pass
    return total_size

# 辅助函数：同步物理目录到数据库
def sync_directory_to_db(db: Session, base_dir: str, current_path: str, is_public: bool, user_id: int, depth: int = 0):
    """
    递归扫描物理目录并更新数据库
    base_dir: 物理根目录 (e.g. uploads/public)
    current_path: 当前相对路径 (e.g. /)
    depth: 递归深度限制，防止过深
    """
    # 限制递归深度，防止死循环或性能问题
    if depth > 5:
        return

    physical_path = os.path.join(base_dir, current_path.strip("/").replace("..", ""))
    if not os.path.exists(physical_path):
        return

    # 获取物理目录下的所有项
    try:
        items = os.listdir(physical_path)
    except OSError:
        return

    # 获取 DB 中该路径下的所有项
    db_files = crud.get_files(db, path=current_path, is_public=is_public, user_id=user_id)
    
    # 修复重复文件问题：
    # 如果 DB 中存在同名文件，保留一个，删除其他的
    # 我们使用字典来追踪已见过的名字
    seen_files = {}
    duplicates_to_delete = []
    
    for f in db_files:
        if f.name in seen_files:
            duplicates_to_delete.append(f)
        else:
            seen_files[f.name] = f
            
    # 删除重复的记录
    for dup in duplicates_to_delete:
        crud.delete_file(db, dup.id)
        
    # 使用去重后的字典
    db_file_map = seen_files
    
    # 遍历物理项
    for item_name in items:
        item_path = os.path.join(physical_path, item_name)
        is_dir = os.path.isdir(item_path)
        item_type = "directory" if is_dir else "file"
        
        # 忽略系统文件
        if item_name.startswith("."):
            continue

        if item_name not in db_file_map:
            # DB 中不存在，创建记录
            size = 0
            mime_type = None
            if not is_dir:
                size = os.path.getsize(item_path)
                import mimetypes
                mime_type, _ = mimetypes.guess_type(item_path)
            else:
                # 计算目录大小
                size = calculate_directory_size(item_path)
            
            new_file = schemas.FileCreate(
                name=item_name,
                path=current_path,
                type=item_type,
                size=size,
                mime_type=mime_type,
                is_public=is_public
            )
            crud.create_file(db, new_file, user_id)
            
            # 如果是目录，递归同步
            # ... (保持原样)
        else:
            # DB 中存在，检查是否需要更新（例如大小）
            db_item = db_file_map[item_name]
            new_size = 0
            if not is_dir:
                new_size = os.path.getsize(item_path)
            else:
                new_size = calculate_directory_size(item_path)
                
            if db_item.size != new_size:
                crud.update_file_size(db, db_item.id, new_size)
            
            # 从 map 中移除，表示已处理
            del db_file_map[item_name]
            
            # 同样，去掉递归调用
            # if is_dir:
            #     sync_directory_to_db(db, base_dir, f"{current_path}/{item_name}".replace("//", "/"), is_public, user_id, depth + 1)

    # 处理 DB 中存在但物理上不存在的项 (db_file_map 中剩余的)
    # 暂时不删除，或者标记为丢失？
    # 为了保持一致性，应该删除 DB 记录
    for missing_name, missing_record in db_file_map.items():
        crud.delete_file(db, missing_record.id)

@router.get("/list/public", response_model=List[schemas.FileResponse])
def list_public_files(
    path: str = Query("/", description="Directory path"),
    search: Optional[str] = Query(None, description="Search query"),
    db: Session = Depends(database.get_db)
):
    # Normalize path
    path = path.strip()
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    if path.endswith("/."):
        path = path[:-2]
    if path == "": path = "/"

    # 如果有 search，则搜索 public 目录下的所有文件
    if search:
        # 搜索时不强制 sync，或者只 sync 根目录？
        # 搜索通常是全库搜索，不依赖于当前 path
        # 简单的实现：在 DB 中搜索
        return crud.search_files(db, query=search, is_public=True)
    
    # 正常列表逻辑...
    base_dir = get_storage_path(True)
    # ... (原有逻辑)
    admin_user = crud.get_user_by_username(db, "admin")
    admin_id = admin_user.id if admin_user else 1 # Fallback
    
    sync_directory_to_db(db, base_dir, path, True, admin_id)
    
    return crud.get_files(db, path=path, is_public=True)

@router.get("/list/private", response_model=List[schemas.FileResponse])
def list_private_files(
    path: str = Query("/", description="Directory path"),
    search: Optional[str] = Query(None, description="Search query"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Normalize path
    path = path.strip()
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    if path.endswith("/."):
        path = path[:-2]
    if path == "": path = "/"

    if search:
        return crud.search_files(db, query=search, is_public=False, user_id=current_user.id)

    base_dir = get_storage_path(False, current_user.id)
    sync_directory_to_db(db, base_dir, path, False, current_user.id)
    
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
async def get_file_content(
    file_id: int,
    db: Session = Depends(database.get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional)
):
    current_user = None
    if token:
        try:
            current_user = await auth.get_current_user(token, db)
        except Exception:
            pass

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
async def preview_ipynb(
    file_id: int,
    db: Session = Depends(database.get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional)
):
    """
    Convert IPYNB to HTML for preview
    """
    current_user = None
    if token:
        try:
            current_user = await auth.get_current_user(token, db)
        except Exception:
            pass

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
