import os
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import ProcessRequest, ProcessResponse, Recipe, ChatRequest
from .download import download_tiktok
from .transcribe import transcribe_video
from .extract import extract_recipe
from .db import lookup_recipe, save_recipe, list_recipes_for_user
from .database import dispose_engine


def _run_migrations() -> None:
    from sqlalchemy import inspect, text
    from .database import get_engine

    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location",
        os.path.join(os.path.dirname(__file__), "..", "migrations"),
    )

    eng = get_engine()
    inspector = inspect(eng)
    has_alembic = "alembic_version" in inspector.get_table_names()
    has_recipes = "recipes" in inspector.get_table_names()

    if has_recipes and not has_alembic:
        # DB predates Alembic; stamp it at 001 so only newer migrations run
        command.stamp(alembic_cfg, "001")

    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    yield
    dispose_engine()


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
    user_id = req.user_id

    cached = lookup_recipe(url_str, user_id=user_id)
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

    save_recipe(url_str, transcript, result.caption, recipe_dict, user_id=user_id)

    return ProcessResponse(transcript=transcript, caption=result.caption, recipe=recipe)


@app.get("/recipes")
async def get_user_recipes(user_id: str):
    return list_recipes_for_user(user_id)


def _build_chat_prompt(req: ChatRequest) -> tuple[str, list[dict]]:
    ingredients_text = "\n".join(
        f"- {ing.amount or ''} {ing.unit or ''} {ing.name} {('(' + ing.notes + ')') if ing.notes else ''}".strip()
        for ing in req.recipe.ingredients
    )
    steps_text = "\n".join(
        f"  Step {s.order}{' [COMPLETED]' if s.order in req.completed_steps else ''}{' [CURRENT]' if s.order == req.current_step else ''}: {s.instruction}"
        for s in req.recipe.steps
    )

    system_prompt = f"""You are a friendly, expert cooking assistant helping someone cook a recipe in real time.

Recipe: {req.recipe.title}
{f'Description: {req.recipe.description}' if req.recipe.description else ''}

Ingredients:
{ingredients_text}

Steps:
{steps_text}

The user is currently on Step {req.current_step}. Steps marked [COMPLETED] are already done.

Give concise, practical advice. If they describe a problem, help them fix it with what they likely have on hand. Keep answers short (2-4 sentences) unless more detail is needed.

Format your response using markdown to make it easy to scan:
- Use **bold** for key actions, ingredient names, or important values (temperatures, times, amounts)
- Use bullet points or numbered lists when giving multiple tips or steps
- Use *italics* for emphasis on warnings or important notes
- Do NOT use headings or code blocks"""

    return system_prompt, [{"role": "user", "content": req.message}]


@app.post("/chat")
async def chat_about_step(req: ChatRequest):
    import anthropic
    from fastapi.responses import StreamingResponse

    api_key = _get_api_key()
    client = anthropic.Anthropic(api_key=api_key)
    system_prompt, messages = _build_chat_prompt(req)

    def generate():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=system_prompt,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(generate(), media_type="text/plain")
