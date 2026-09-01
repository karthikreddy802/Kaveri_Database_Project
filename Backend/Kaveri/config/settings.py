import os
from dotenv import load_dotenv

# Load the .env file from the project root directory
# Project root is two levels up from Backend/Kaveri/config/settings.py
# (i.e. c:\Users\Karthik\Downloads\Project-Kaveri)
_here = os.path.dirname(os.path.abspath(__file__))
_kaveri_dir = os.path.dirname(_here)
_backend_dir = os.path.dirname(_kaveri_dir)
_project_root = os.path.dirname(_backend_dir)
load_dotenv()
load_dotenv(os.path.join(_project_root, ".env"))
load_dotenv(os.path.join(_kaveri_dir, ".env"))

# Enforce SECRET_KEY check at startup (Task 2.10)
# os.environ[...] will raise a KeyError immediately if the key is missing.
try:
    SECRET_KEY = os.environ["SECRET_KEY"]
except KeyError:
    raise RuntimeError(
        "CRITICAL ERROR: SECRET_KEY is missing from environment. "
        "The application cannot start without a valid SECRET_KEY."
    )

# Database Configuration (fallback to Django settings defaults if not in env)
DB_NAME = os.getenv("DB_NAME", "kaveri")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "2004")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

# JWT configuration
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALGORITHM = "HS256"
