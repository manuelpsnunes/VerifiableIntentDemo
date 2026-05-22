"""In-process async event bus for streaming demo events to WebSocket clients.

Each event is a small dict like::

    {
        "step": 3,
        "role": "agent",
        "action": "selected_product",
        "summary": "Agent chose Babolat Pure Aero ($279.99)",
        "payload": {...},                # role-specific structured data
        "ts": 1716258000.123,
    }

The bus is a singleton — every component imports the same instance.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._history: list[dict] = []
        self._lock = asyncio.Lock()

    async def publish(self, event: dict[str, Any]) -> None:
        event = {"ts": time.time(), **event}
        async with self._lock:
            self._history.append(event)
            # Cap history so a long-running server doesn't grow unbounded.
            if len(self._history) > 500:
                del self._history[: len(self._history) - 500]
            for q in list(self._subscribers):
                # Drop the event for slow consumers rather than block producers.
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.add(q)
            # Replay recent history to a new subscriber so a late-joining UI
            # can render the current state of an in-flight demo.
            for event in self._history[-50:]:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    break
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subscribers.discard(q)

    async def reset_history(self) -> None:
        async with self._lock:
            self._history.clear()


bus = EventBus()
