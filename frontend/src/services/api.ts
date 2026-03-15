import axios from "axios";

const API_BASE = import.meta.env.PROD
  ? "https://rasoi-api.skdev.one/api"
  : "/api";

const api = axios.create({
  baseURL: API_BASE,
});

export interface Recipe {
  id: number;
  name: string;
  name_hi: string | null;
  cuisine: string | null;
  region: string | null;
  difficulty: string | null;
  prep_time: number | null;
  cook_time: number | null;
}

export interface Ingredient {
  id: number;
  name: string;
  name_hi: string | null;
  quantity: string | null;
  unit: string | null;
  is_optional: boolean;
}

export interface Step {
  id: number;
  step_number: number;
  instruction: string;
  instruction_hi: string | null;
  duration_mins: number | null;
  tips: string | null;
}

export interface RecipeDetail extends Recipe {
  ingredients: Ingredient[];
  steps: Step[];
}

export async function getRecipes(query?: string): Promise<Recipe[]> {
  const params = query ? { q: query } : {};
  const { data } = await api.get("/recipes", { params });
  return data;
}

export async function getRecipe(id: number): Promise<RecipeDetail> {
  const { data } = await api.get(`/recipes/${id}`);
  return data;
}

export interface Session {
  id: number;
  recipe_id: number | null;
  current_step: number;
  language: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  recipe_context: Record<string, unknown> | null;
  audio_url: string | null;
}

export async function createSession(recipeId: number, language: string = "en"): Promise<Session> {
  const { data } = await api.post("/sessions", { recipe_id: recipeId, language });
  return data;
}

export async function sendMessage(sessionId: number, message: string, language: string = "en"): Promise<ChatResponse> {
  const { data } = await api.post("/chat", { session_id: sessionId, message, language });
  return data;
}

export interface VisionResult {
  ingredient: string;
  ingredient_hi: string | null;
  confidence: number;
  matching_recipes: { id: number; name: string }[];
}

export async function identifyIngredient(imageFile: File): Promise<VisionResult> {
  const formData = new FormData();
  formData.append("file", imageFile);
  const { data } = await api.post("/vision/identify", formData);
  return data;
}

export default api;
