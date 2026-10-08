"""Short-lived query results shared by dashboard, preview, and PDF requests."""
from collections import OrderedDict
from concurrent.futures import Future
from threading import Lock
from time import monotonic


class QueryResultCache:
    def __init__(self, ttl=60, max_entries=32, max_bytes=64 * 1024 * 1024):
        self.ttl = ttl
        self.max_entries = max_entries
        self.max_bytes = max_bytes
        self._entries = OrderedDict()
        self._pending = {}
        self._lock = Lock()

    def clear(self):
        with self._lock:
            self._entries.clear()

    def get_or_load(self, key, load):
        with self._lock:
            now = monotonic()
            for expired in [k for k, (deadline, _, _) in self._entries.items() if deadline <= now]:
                del self._entries[expired]
            if key in self._entries:
                self._entries.move_to_end(key)
                return self._entries[key][1].copy(deep=True)
            future = self._pending.get(key)
            owner = future is None
            if owner:
                future = self._pending[key] = Future()

        if not owner:
            return future.result().copy(deep=True)
        try:
            result = load()
            stored = result.copy(deep=True)
            size = int(stored.memory_usage(index=True, deep=True).sum())
            with self._lock:
                if size <= self.max_bytes:
                    self._entries[key] = (monotonic() + self.ttl, stored, size)
                    while len(self._entries) > self.max_entries or sum(entry[2] for entry in self._entries.values()) > self.max_bytes:
                        self._entries.popitem(last=False)
            future.set_result(stored)
            return result
        except BaseException as exc:
            future.set_exception(exc)
            raise
        finally:
            with self._lock:
                self._pending.pop(key, None)
