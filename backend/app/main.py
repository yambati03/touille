import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import ProcessRequest, ProcessResponse, Recipe
from .download import download_tiktok
from .transcribe import transcribe_video
from .extract import extract_recipe

app = FastAPI(title="Touille", description="TikTok recipe extractor")

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
    api_key = _get_api_key()
    video_path: str | None = None

    try:
        result = download_tiktok(str(req.url))
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

    return ProcessResponse(transcript=transcript, caption=result.caption, recipe=recipe)
