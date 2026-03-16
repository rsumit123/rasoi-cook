import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

const LANGUAGES = [
  { code: "hi", label: "Hindi" },
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
];

export default function CookingSession() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showRecipe, setShowRecipe] = useState(true);
  const [language, setLanguage] = useState("hi");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isThinking = loading || voiceProcessing;

  useEffect(() => {
    if (!id) return;
    const recipeId = Number(id);
    getRecipe(recipeId).then((r) => {
      setRecipe(r);
      createSession(recipeId, language).then((s) => {
        setSessionId(s.id);
        setMessages([
          {
            role: "assistant",
            content:
              language === "hi"
                ? `Namaste! Main aapko ${r.name} banane mein madad karungi. Step 1 se shuru karte hain. Kuch bhi poochiye!`
                : `Welcome! I'll help you cook ${r.name}. Let's start with Step 1. Ask me anything!`,
          },
        ]);
      });
    });
  }, [id]);

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
      const response = await sendMessage(sessionId, userMessage, language);
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, please try again." },
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

  if (!recipe) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>Loading recipe...</div>;
  }

  const totalSteps = recipe.steps.length;
  const activeStep = recipe.steps.find((s) => s.step_number === currentStep);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 44px)",
        maxWidth: "650px",
        margin: "0 auto",
        overflow: "hidden",
      }}
    >
      {/* Recipe Card */}
      <div
        style={{
          padding: "0.6rem 0.8rem",
          borderBottom: "1px solid #eee",
          background: "#fafafa",
          flexShrink: 0,
          overflowY: showRecipe ? "auto" : "hidden",
          maxHeight: showRecipe ? "45vh" : "auto",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setShowRecipe(!showRecipe)}
        >
          <div>
            <strong>{recipe.name}</strong>
            {recipe.name_hi && <span style={{ color: "#777", marginLeft: "0.4rem", fontSize: "0.85rem" }}>{recipe.name_hi}</span>}
            {!showRecipe && (
              <span style={{ color: "#e85d04", fontSize: "0.8rem", marginLeft: "0.5rem" }}>
                Step {currentStep}/{totalSteps}
              </span>
            )}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#999", flexShrink: 0 }}>
            {showRecipe ? "\u25B2 Hide" : "\u25BC Show"}
          </span>
        </div>

        {showRecipe && (
          <>
            {/* Step navigator */}
            <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "#fff5eb", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep <= 1}
                  style={{
                    padding: "0.3rem 0.7rem",
                    border: "none",
                    borderRadius: "6px",
                    background: currentStep <= 1 ? "#e8e8e8" : "#e85d04",
                    color: currentStep <= 1 ? "#bbb" : "white",
                    cursor: currentStep <= 1 ? "default" : "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  {"\u2190"} Prev
                </button>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#333" }}>
                  Step {currentStep} / {totalSteps}
                </span>
                <button
                  onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
                  disabled={currentStep >= totalSteps}
                  style={{
                    padding: "0.3rem 0.7rem",
                    border: "none",
                    borderRadius: "6px",
                    background: currentStep >= totalSteps ? "#e8e8e8" : "#e85d04",
                    color: currentStep >= totalSteps ? "#bbb" : "white",
                    cursor: currentStep >= totalSteps ? "default" : "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Next {"\u2192"}
                </button>
              </div>
              {activeStep && (
                <div style={{ marginTop: "0.4rem" }}>
                  <p style={{ margin: "0 0 0.2rem", fontSize: "0.88rem", color: "#222" }}>{activeStep.instruction}</p>
                  {activeStep.instruction_hi && (
                    <p style={{ margin: "0 0 0.2rem", color: "#666", fontSize: "0.8rem" }}>{activeStep.instruction_hi}</p>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "#888" }}>
                    {activeStep.duration_mins != null && <span>~{activeStep.duration_mins} min</span>}
                    {activeStep.tips && <span style={{ marginLeft: "0.4rem" }}>Tip: {activeStep.tips}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Ingredients */}
            <details style={{ marginTop: "0.4rem", fontSize: "0.82rem" }}>
              <summary style={{ cursor: "pointer", color: "#e85d04", fontWeight: 600 }}>
                Ingredients ({recipe.ingredients.length})
              </summary>
              <ul style={{ padding: "0.3rem 0 0 1rem", margin: 0 }}>
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} style={{ marginBottom: "0.2rem", color: "#333" }}>
                    <span>{ing.quantity} {ing.unit} </span>
                    <strong>{ing.name}</strong>
                    {ing.name_hi && <span style={{ color: "#666" }}> ({ing.name_hi})</span>}
                    {ing.is_optional && (
                      <span style={{ color: "#e85d04", fontSize: "0.72rem", marginLeft: "0.3rem", fontWeight: 500 }}>
                        optional
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0.5rem 0.8rem",
          minHeight: 0,
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "0.5rem 0.8rem",
                borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                background: msg.role === "user" ? "#e85d04" : "#f0f0f0",
                color: msg.role === "user" ? "white" : "#222",
                fontSize: "0.9rem",
                lineHeight: 1.45,
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.5rem" }}>
            <div
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "12px 12px 12px 2px",
                background: "linear-gradient(135deg, #fff5eb, #fef3c7)",
                border: "1px solid #fed7aa",
                fontSize: "0.85rem",
                color: "#b45309",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "1rem" }}>
                {"\u{1F373}"}
              </span>
              <span>
                {voiceProcessing ? "Rasoi is listening & thinking..." : "Rasoi is thinking..."}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Floating voice button */}
      {recipe && sessionId && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0.4rem 0", flexShrink: 0 }}>
          <VoiceButton
            sessionId={sessionId}
            language={language}
            onTranscript={(text) => {
              setVoiceProcessing(true);
              setMessages((prev) => [...prev, { role: "user", content: text }]);
            }}
            onResponse={(text) => {
              setVoiceProcessing(false);
              setMessages((prev) => [...prev, { role: "assistant", content: text }]);
            }}
            onError={(err) => {
              setVoiceProcessing(false);
              setMessages((prev) => [...prev, { role: "assistant", content: err }]);
            }}
          />
        </div>
      )}

      {/* Text input bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.4rem 0.6rem",
          borderTop: "1px solid #eee",
          background: "white",
          flexShrink: 0,
        }}
      >
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            padding: "0.35rem 0.3rem",
            borderRadius: "6px",
            border: "1px solid #ddd",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "#e85d04",
            background: "#fff8f0",
            cursor: "pointer",
            flexShrink: 0,
            outline: "none",
          }}
          title="Response language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or hold mic above..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "0.55rem 0.8rem",
            fontSize: "0.9rem",
            borderRadius: "20px",
            border: "1px solid #ddd",
            outline: "none",
            minWidth: 0,
          }}
        />

        <CameraCapture
          onIngredientIdentified={(result: VisionResult) => {
            const hi = result.ingredient_hi ? ` (${result.ingredient_hi})` : "";
            const recipes = result.matching_recipes.length > 0
              ? ` Recipes: ${result.matching_recipes.map((r) => r.name).join(", ")}.`
              : "";
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Identified: ${result.ingredient}${hi} (${Math.round(result.confidence * 100)}%).${recipes}` },
            ]);
          }}
        />

        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: "0.55rem 0.8rem",
            background: loading || !input.trim() ? "#ccc" : "#e85d04",
            color: "white",
            border: "none",
            borderRadius: "20px",
            fontSize: "0.9rem",
            cursor: loading || !input.trim() ? "default" : "pointer",
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {"\u2191"}
        </button>
      </div>
    </div>
  );
}
