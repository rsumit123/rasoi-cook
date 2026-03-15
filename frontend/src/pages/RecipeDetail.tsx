import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getRecipe, type RecipeDetail as RecipeDetailType } from "../services/api";

export default function RecipeDetail() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<RecipeDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getRecipe(Number(id))
      .then(setRecipe)
      .catch(() => setError("Recipe not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={container}>Loading...</div>;
  if (error || !recipe) return <div style={container}>{error || "Recipe not found"}</div>;

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  return (
    <div style={container}>
      <Link to="/recipes" style={{ color: "#e85d04", textDecoration: "none", fontSize: "0.9rem" }}>
        &larr; Back to recipes
      </Link>

      <h1 style={{ margin: "0.5rem 0 0.2rem" }}>{recipe.name}</h1>
      {recipe.name_hi && <p style={{ color: "#888", margin: "0 0 0.5rem", fontSize: "1.1rem" }}>{recipe.name_hi}</p>}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem", fontSize: "0.9rem", color: "#666" }}>
        {recipe.region && <span>{recipe.region}</span>}
        {recipe.difficulty && <span style={badge}>{recipe.difficulty}</span>}
        {recipe.prep_time != null && <span>Prep: {recipe.prep_time} min</span>}
        {recipe.cook_time != null && <span>Cook: {recipe.cook_time} min</span>}
        {totalTime > 0 && <span style={{ fontWeight: "bold" }}>Total: {totalTime} min</span>}
      </div>

      <h2 style={sectionHeader}>Ingredients</h2>
      <ul style={{ padding: "0 0 0 1.2rem", marginBottom: "1.5rem" }}>
        {recipe.ingredients.map((ing) => (
          <li key={ing.id} style={{ marginBottom: "0.4rem" }}>
            <span>
              {ing.quantity} {ing.unit} <strong>{ing.name}</strong>
            </span>
            {ing.name_hi && <span style={{ color: "#aaa", marginLeft: "0.4rem" }}>({ing.name_hi})</span>}
            {ing.is_optional && <span style={{ ...badge, marginLeft: "0.4rem", fontSize: "0.75rem" }}>optional</span>}
          </li>
        ))}
      </ul>

      <h2 style={sectionHeader}>Steps</h2>
      <ol style={{ padding: "0 0 0 1.2rem" }}>
        {recipe.steps.map((step) => (
          <li key={step.id} style={{ marginBottom: "1rem" }}>
            <p style={{ margin: "0 0 0.3rem" }}>{step.instruction}</p>
            {step.instruction_hi && (
              <p style={{ margin: "0 0 0.3rem", color: "#888", fontSize: "0.9rem" }}>{step.instruction_hi}</p>
            )}
            <div style={{ fontSize: "0.8rem", color: "#999" }}>
              {step.duration_mins != null && <span>~{step.duration_mins} min</span>}
              {step.tips && <span style={{ marginLeft: "0.5rem" }}>Tip: {step.tips}</span>}
            </div>
          </li>
        ))}
      </ol>

      <Link
        to={`/cook/${recipe.id}`}
        style={{
          display: "inline-block",
          padding: "0.8rem 2rem",
          background: "#e85d04",
          color: "white",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "1.1rem",
          marginTop: "1rem",
        }}
      >
        Start Cooking
      </Link>
    </div>
  );
}

const container: React.CSSProperties = {
  padding: "1rem",
  maxWidth: "650px",
  margin: "0 auto",
};

const sectionHeader: React.CSSProperties = {
  fontSize: "1.2rem",
  borderBottom: "2px solid #e85d04",
  paddingBottom: "0.3rem",
  marginBottom: "0.8rem",
};

const badge: React.CSSProperties = {
  background: "#f0f0f0",
  padding: "0.15rem 0.5rem",
  borderRadius: "12px",
  fontSize: "0.85rem",
};
