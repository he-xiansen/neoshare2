# Stop any existing Jupyter processes (optional, but good practice if possible, though PowerShell kill might be aggressive)
# Write-Host "Starting Jupyter Notebook..."

$UploadsDir = Resolve-Path ".\uploads"
Write-Host "Jupyter Root Directory: $UploadsDir"

# Navigate to uploads directory
cd $UploadsDir

# Define the command arguments
# --ServerApp.token: Sets the fixed token
# --ServerApp.password: Clears any password requirement
# --ServerApp.allow_origin: Allows CORS requests (important for API access if needed)
# --ServerApp.tornado_settings: Sets CSP headers to allow iframe embedding
# --no-browser: Prevents opening a new tab automatically
# --port 8888: Enforce port 8888

# Note: Using python -m jupyter notebook to ensure we use the python environment's jupyter
python -m jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --ServerApp.token='neoshare2024' --ServerApp.password='' --ServerApp.allow_origin='*' --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': 'frame-ancestors *'}}"
