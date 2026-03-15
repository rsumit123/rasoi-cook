import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getRecipe,
  createSession,
  sendMessage,
  type RecipeDetail,
  type ChatMessage,
} from "../services/api";
import VoiceButton from "../components/VoiceButton.tsx";
import CameraCapture from "../components/CameraCapture.tsx";
import type { VisionResult } from "../services/api";

export default function CookingSession() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showRecipe, setShowRecipe] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load recipe and create session
  useEffect(() => {
    if (!id) return;
    const recipeId = Number(id);

    getRecipe(recipeId).then((r) => {
      setRecipe(r);
      createSession(recipeId).then((s) => {
        setSessionId(s.id);
        // Send initial greeting
        setMessages([
          {
            role: "assistant",
            content: `Welcome! I'll help you cook ${r.name}. Let's start with Step 1. Ask me anything along the way!`,
          },
        ]);
      });
    });
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await sendMessage(sessionId, userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble responding. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!recipe) return <div style={container}>Loading recipe...</div>;

  const totalSteps = recipe.steps.length;
  const activeStep = recipe.steps.find((s) => s.step_number === currentStep);

  return (
    <div style={{ ...container, display: "flex", flexDirection: "column", height: "calc(100vh - 50px)" }}>
      {/* Recipe Card */}
      <div style={recipeCard}>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setShowRecipe(!showRecipe)}
        >
          <div>
            <strong style={{ fontSize: "1.1rem" }}>{recipe.name}</strong>
            {recipe.name_hi && <span style={{ color: "#888", marginLeft: "0.5rem" }}>{recipe.name_hi}</span>}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>{showRecipe ? "Hide" : "Show"}</span>
        </div>

        {showRecipe && (
          <>
            {/* Step navigator */}
            <div style={{ marginTop: "0.8rem", padding: "0.6rem", background: "#fff8f0", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep <= 1}
                  style={stepBtn}
                >
                  Prev
                </button>
                <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                  Step {currentStep} of {totalSteps}
                </span>
                <button
                  onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
                  disabled={currentStep >= totalSteps}
                  style={stepBtn}
                >
                  Next
                </button>
              </div>
              {activeStep && (
                <div style={{ marginTop: "0.5rem" }}>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "0.95rem" }}>{activeStep.instruction}</p>
                  {activeStep.instruction_hi && (
                    <p style={{ margin: "0 0 0.3rem", color: "#888", fontSize: "0.85rem" }}>{activeStep.instruction_hi}</p>
                  )}
                  <div style={{ fontSize: "0.8rem", color: "#999" }}>
                    {activeStep.duration_mins != null && <span>~{activeStep.duration_mins} min</span>}
                    {activeStep.tips && <span style={{ marginLeft: "0.5rem" }}>Tip: {activeStep.tips}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Ingredients (collapsible) */}
            <details style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              <summary style={{ cursor: "pointer", color: "#e85d04" }}>Ingredients ({recipe.ingredients.length})</summary>
              <ul style={{ padding: "0.3rem 0 0 1.2rem", margin: 0 }}>
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} style={{ marginBottom: "0.2rem" }}>
                    {ing.quantity} {ing.unit} {ing.name}
                    {ing.name_hi && <span style={{ color: "#aaa" }}> ({ing.name_hi})</span>}
                    {ing.is_optional && <span style={{ color: "#ccc" }}> [optional]</span>}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div style={chatArea}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "0.6rem",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "0.6rem 0.9rem",
                borderRadius: "12px",
                background: msg.role === "user" ? "#e85d04" : "#f0f0f0",
                color: msg.role === "user" ? "white" : "inherit",
                fontSize: "0.95rem",
                lineHeight: "1.4",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.6rem" }}>
            <div style={{ padding: "0.6rem 0.9rem", borderRadius: "12px", background: "#f0f0f0", color: "#888" }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Voice Button */}
      {recipe && sessionId && (
        <VoiceButton
          recipeId={Number(id)}
          language="en"
          onTranscript={(text) => {
            setMessages((prev) => [...prev, { role: "user", content: text }]);
          }}
          onResponse={(text) => {
            setMessages((prev) => [...prev, { role: "assistant", content: text }]);
          }}
        />
      )}

      {/* Input Bar */}
      <div style={inputBar}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the recipe..."
          disabled={loading}
          style={inputField}
        />
        <CameraCapture
          onIngredientIdentified={(result: VisionResult) => {
            const hindiPart = result.ingredient_hi ? ` (${result.ingredient_hi})` : "";
            const recipePart =
              result.matching_recipes.length > 0
                ? ` Found ${result.matching_recipes.length} matching recipe(s): ${result.matching_recipes.map((r) => r.name).join(", ")}.`
                : "";
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Identified ingredient: ${result.ingredient}${hindiPart} (${Math.round(result.confidence * 100)}% confidence).${recipePart}`,
              },
            ]);
          }}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} style={sendBtn}>
          Send
        </button>
      </div>

      <Link to={`/recipes/${id}`} style={{ textAlign: "center", display: "block", padding: "0.5rem", color: "#888", fontSize: "0.85rem", textDecoration: "none" }}>
        Back to recipe
      </Link>
    </div>
  );
}

const container: React.CSSProperties = {
  padding: "0.5rem",
  maxWidth: "650px",
  margin: "0 auto",
};

const recipeCard: React.CSSProperties = {
  padding: "0.8rem",
  border: "1px solid #eee",
  borderRadius: "10px",
  marginBottom: "0.5rem",
  background: "#fafafa",
};

const chatArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "0.5rem",
  minHeight: 0,
};

const inputBar: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  padding: "0.5rem 0",
};

const inputField: React.CSSProperties = {
  flex: 1,
  padding: "0.7rem",
  fontSize: "1rem",
  borderRadius: "8px",
  border: "1px solid #ccc",
  outline: "none",
};

const sendBtn: React.CSSProperties = {
  padding: "0.7rem 1.2rem",
  background: "#e85d04",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "1rem",
  cursor: "pointer",
};

const stepBtn: React.CSSProperties = {
  padding: "0.3rem 0.8rem",
  border: "1px solid #ddd",
  borderRadius: "6px",
  background: "white",
  cursor: "pointer",
  fontSize: "0.85rem",
};
