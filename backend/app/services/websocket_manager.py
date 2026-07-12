from __future__ import annotations

from dataclasses import dataclass

from fastapi import WebSocket


@dataclass(eq=False)
class Client:
    socket: WebSocket
    user_id: int
    institution_id: int
    role: str


class WebSocketManager:
    def __init__(self) -> None:
        self.clients: set[Client] = set()

    async def connect(self, socket: WebSocket, user_id: int, institution_id: int, role: str) -> Client:
        await socket.accept()
        client = Client(socket, user_id, institution_id, role)
        self.clients.add(client)
        return client

    def disconnect(self, client: Client) -> None:
        self.clients.discard(client)

    async def publish(self, event_type: str, data: dict, institution_id: int | None = None, oversight: bool = True) -> None:
        payload = {"type": event_type, "data": data}
        dead: list[Client] = []
        for client in self.clients:
            authorised = institution_id is None or client.institution_id == institution_id or (oversight and client.role == "BOU_OVERSIGHT")
            if authorised:
                try:
                    await client.socket.send_json(payload)
                except Exception:
                    dead.append(client)
        for client in dead:
            self.disconnect(client)


manager = WebSocketManager()
