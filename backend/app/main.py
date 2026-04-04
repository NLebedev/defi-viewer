from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import meta, trades, pricing, logs

app = FastAPI(title="CEX-DEX Viewer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(trades.router)
app.include_router(pricing.router)
app.include_router(logs.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
