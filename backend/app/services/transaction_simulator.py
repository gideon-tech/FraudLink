from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select

from ..config import get_settings
from ..database import SessionLocal
from ..models import Institution, Transaction
from .websocket_manager import manager


class TransactionSimulator:
    def __init__(self) -> None:
        self.task: asyncio.Task | None = None
        self.generated = 0

    @property
    def running(self) -> bool:
        return self.task is not None and not self.task.done()

    def status(self) -> dict:
        return {"running": self.running, "generated_count": self.generated, "mode": "SYNTHETIC_DEMO"}

    async def start(self) -> dict:
        if self.running:
            return self.status()
        self.task = asyncio.create_task(self._run())
        await manager.publish("SIMULATOR_STATUS_CHANGED", self.status())
        return self.status()

    async def stop(self) -> dict:
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
        await manager.publish("SIMULATOR_STATUS_CHANGED", self.status())
        return self.status()

    async def _run(self) -> None:
        settings = get_settings()
        while True:
            with SessionLocal() as db:
                institutions = list(db.scalars(select(Institution).where(Institution.code != "BOU")))
                if institutions:
                    source, destination = random.sample(institutions, 2)
                    sequence = (db.scalar(select(func.max(Transaction.id))) or 0) + 1
                    tx = Transaction(transaction_reference=f"SIM-LIVE-{sequence:08d}", source_institution_id=source.id, source_subject_reference=f"MSISDN:v1:NORMAL{random.randrange(1000,9999)}", destination_institution_id=destination.id, destination_subject_reference=f"MSISDN:v1:NORMAL{random.randrange(1000,9999)}", amount=Decimal(random.randrange(10_000, 800_000)), currency="UGX", transaction_type=random.choice(["TRANSFER", "CASH_IN", "MERCHANT_PAYMENT"]), status="COMPLETED", risk="LOW", event_time=datetime.now(timezone.utc), simulated=True)
                    db.add(tx)
                    db.commit()
                    self.generated += 1
                    await manager.publish("TRANSACTION_RECEIVED", serialize_transaction(tx))
            await asyncio.sleep(random.uniform(settings.simulator_min_interval_seconds, settings.simulator_max_interval_seconds))


def serialize_transaction(tx: Transaction) -> dict:
    return {"id": tx.id, "transaction_reference": tx.transaction_reference, "source_institution": tx.source_institution.name if tx.source_institution else None, "source_subject_reference": tx.source_subject_reference, "destination_institution": tx.destination_institution.name if tx.destination_institution else None, "destination_subject_reference": tx.destination_subject_reference, "amount": float(tx.amount), "currency": tx.currency, "transaction_type": tx.transaction_type, "status": tx.status, "risk": tx.risk, "flag_reason": tx.flag_reason, "event_time": tx.event_time.isoformat(), "simulated": tx.simulated}


simulator = TransactionSimulator()
