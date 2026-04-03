from datetime import datetime, timedelta, timezone
from app.config import INDEX_PREFIX


def resolve_indices(start_iso: str, end_iso: str) -> str:
    start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))

    indices = []
    current = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    while current <= end_dt:
        indices.append(f"{INDEX_PREFIX}{current.strftime('%Y-%m-%d')}")
        current += timedelta(days=1)

    return ",".join(indices)
