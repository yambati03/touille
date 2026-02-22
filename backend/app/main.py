import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import ProcessRequest, ProcessResponse, Recipe
from .download import download_tiktok
from .transcribe import transcribe_video
from .extract import extract_recipe
from .db import init_db, close_db, lookup_recipe, save_recipe


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    close_db()


app = FastAPI(title="Touille", description="TikTok recipe extractor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return key


@app.get("/health")
async def health():
    return {"status": "ok", "dev_reload": "works"}


@app.post("/process", response_model=ProcessResponse)
async def process_video(req: ProcessRequest):
    url_str = str(req.url)

    cached = lookup_recipe(url_str)
    if cached is not None:
        return ProcessResponse(
            transcript=cached["transcript"],
            caption=cached["caption"],
            recipe=Recipe(**cached["recipe"]),
        )

    api_key = _get_api_key()

    try:
        result = download_tiktok(url_str)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=f"Failed to download video: {e}")

    try:
        transcript = transcribe_video(result.video_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        if result.video_path and os.path.exists(result.video_path):
            os.unlink(result.video_path)

    try:
        recipe_dict = extract_recipe(transcript, api_key, caption=result.caption)
        recipe = Recipe(**recipe_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recipe extraction failed: {e}")

    save_recipe(url_str, transcript, result.caption, recipe_dict)

    return ProcessResponse(transcript=transcript, caption=result.caption, recipe=recipe)
