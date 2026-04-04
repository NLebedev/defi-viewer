from fastapi import APIRouter
from app.opensearch_client import get_client
from app.config import INDEX_PREFIX

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/hostnames")
def get_hostnames():
    client = get_client()
    body = {
        "size": 0,
        "aggs": {"hostnames": {"terms": {"field": "hostname.keyword", "size": 100}}},
    }
    resp = client.search(index=f"{INDEX_PREFIX}*", body=body)
    buckets = resp["aggregations"]["hostnames"]["buckets"]
    return [b["key"] for b in buckets]


@router.get("/pairs")
def get_pairs(hostname: str):
    client = get_client()
    body = {
        "size": 0,
        "query": {"term": {"hostname.keyword": hostname}},
        "aggs": {"pairs": {"terms": {"field": "pair.keyword", "size": 200}}},
    }
    resp = client.search(index=f"{INDEX_PREFIX}*", body=body)
    buckets = resp["aggregations"]["pairs"]["buckets"]
    # Filter out empty pairs
    return [b["key"] for b in buckets if b["key"]]
