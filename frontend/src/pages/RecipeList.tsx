import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecipes, type Recipe } from "../services/api";

export default function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getRecipes(search || undefined)
        .then(setRecipes)
        .catch(() => setRecipes([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div style={{ padding: "1rem", maxWidth: "600px", margin: "0 auto" }}>
      <h2>Recipes</h2>
      <input
        type="text"
        placeholder="Search recipes... (e.g. paneer, south indian, easy)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "0.7rem",
          fontSize: "1rem",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "1rem",
          boxSizing: "border-box",
        }}
      />
      {loading ? (
        <p style={{ color: "#888" }}>Loading recipes...</p>
      ) : recipes.length === 0 ? (
        <p style={{ color: "#888" }}>No recipes found. Try a different search.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {recipes.map((r) => (
            <li key={r.id} style={{ marginBottom: "0.8rem" }}>
              <Link
                to={`/recipes/${r.id}`}
                style={{
                  display: "block",
                  padding: "1rem",
                  border: "1px solid #eee",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#e85d04")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#eee")}
              >
                <strong>{r.name}</strong>
                {r.name_hi && <span style={{ color: "#999", marginLeft: "0.5rem" }}>{r.name_hi}</span>}
                <div style={{ fontSize: "0.85rem", color: "#888", marginTop: "0.3rem" }}>
                  {r.region} &middot; {r.difficulty} &middot; {(r.prep_time || 0) + (r.cook_time || 0)} min
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
