from backend.app.database import Base, SessionLocal, engine
from backend.app.seed import seed_database

Base.metadata.create_all(engine)
with SessionLocal() as db:
    seed_database(db)
print("Synthetic MoMo FraudLink demo data seeded.")

