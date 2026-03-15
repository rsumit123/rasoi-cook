from pydantic import BaseModel


class IngredientResponse(BaseModel):
    id: int
    name: str
    name_hi: str | None = None
    quantity: str | None = None
    unit: str | None = None
    is_optional: bool = False

    model_config = {"from_attributes": True}


class StepResponse(BaseModel):
    id: int
    step_number: int
    instruction: str
    instruction_hi: str | None = None
    duration_mins: int | None = None
    tips: str | None = None

    model_config = {"from_attributes": True}


class RecipeListResponse(BaseModel):
    id: int
    name: str
    name_hi: str | None = None
    cuisine: str | None = None
    region: str | None = None
    difficulty: str | None = None
    prep_time: int | None = None
    cook_time: int | None = None

    model_config = {"from_attributes": True}


class RecipeDetailResponse(RecipeListResponse):
    ingredients: list[IngredientResponse] = []
    steps: list[StepResponse] = []


class SessionCreate(BaseModel):
    recipe_id: int | None = None
    language: str = "en"


class SessionResponse(BaseModel):
    id: int
    recipe_id: int | None = None
    current_step: int
    language: str

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    session_id: int
    message: str
    language: str = "en"


class ChatResponse(BaseModel):
    reply: str
    recipe_context: dict | None = None
    audio_url: str | None = None
