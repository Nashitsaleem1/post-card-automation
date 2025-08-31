# init_db.py
from app.database import engine, Base
from app import models

print("Creating tables in Supabase…")
Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully")
