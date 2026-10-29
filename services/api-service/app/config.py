from pathlib import Path
import os

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[3] / ".env")

database_url = os.environ["DATABASE_URL"]
postgres_url = database_url.removesuffix("?schema=public")
jwt_secret = os.environ["JWT_SECRET"]
allowed_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
