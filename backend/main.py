from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.chat import router as chat_router
from backend.routes.recipes import router as recipes_router
from backend.routes.vision import router as vision_router
from backend.routes.voice_ws import router as voice_router

app = FastAPI(title="AI Cooking Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://rasoi.skdev.one",
        "https://rasoi-api.skdev.one",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recipes_router)
app.include_router(chat_router)
app.include_router(vision_router)
app.include_router(voice_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
