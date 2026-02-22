from pydantic import BaseModel, HttpUrl


class ProcessRequest(BaseModel):
    url: HttpUrl
    user_id: str | None = None


class Servings(BaseModel):
    amount: float | None = None
    unit: str | None = None


class Times(BaseModel):
    prep_minutes: int | None = None
    cook_minutes: int | None = None
    total_minutes: int | None = None


class Ingredient(BaseModel):
    name: str
    amount: float | None = None
    unit: str | None = None
    notes: str | None = None


class Step(BaseModel):
    order: int
    instruction: str
    duration_minutes: int | None = None
    require_timer: bool = False


class Modification(BaseModel):
    what: str
    why: str


class Recipe(BaseModel):
    title: str
    description: str | None = None
    servings: Servings | None = None
    times: Times | None = None
    ingredients: list[Ingredient] = []
    steps: list[Step] = []
    tags: list[str] = []
    equipment: list[str] = []
    notes: str | None = None
    modifications: list[Modification] | None = None


class ProcessResponse(BaseModel):
    transcript: str
    caption: str | None = None
    recipe: Recipe
    recipe_id: int | None = None


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    recipe: Recipe
    current_step: int
    completed_steps: list[int] = []
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


class SettingsResponse(BaseModel):
    user_id: str
    dietary_restrictions: str | None
    spice_tolerance: int
    custom_rules: str | None
    updated_at: str | None


class SettingsUpdate(BaseModel):
    dietary_restrictions: str | None = None
    spice_tolerance: int | None = None
    custom_rules: str | None = None
