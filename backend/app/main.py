from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import get_settings
from .database import Base, SessionLocal, engine
from .models import User
from .security.auth import decode_token
from .seed import seed_database
from .services.transaction_simulator import simulator
from .services.websocket_manager import manager


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # Alembic is used for managed deployments; this keeps demo startup simple.
    with SessionLocal() as db:
        seed_database(db)
    yield
    await simulator.stop()


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", description="Closed synthetic fraud-intelligence exchange MVP.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict:
    return {"status": "healthy", "service": settings.app_name}


@app.websocket("/ws/events")
async def events(socket: WebSocket, token: str):
    try:
        payload = decode_token(token)
        with SessionLocal() as db:
            user = db.get(User, int(payload["sub"]))
            if not user or not user.active:
                await socket.close(code=4401); return
            client = await manager.connect(socket, user.id, user.institution_id, user.role)
        await socket.send_json({"type": "CONNECTED", "data": {"institution_id": client.institution_id, "role": client.role}})
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        if "client" in locals(): manager.disconnect(client)
    except Exception:
        await socket.close(code=4401)

