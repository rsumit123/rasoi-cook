import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecipes, type Recipe } from "../services/api";

const FILTERS = ["All", "easy", "medium", "hard"];

export default function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All");
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

  const filtered = difficulty === "All" ? recipes : recipes.filter((r) => r.difficulty === difficulty);

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Recipes</h1>
        <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "0.2rem" }}>{recipes.length} recipes available</p>
      </div>

      {/* Search */}
      <div style={searchWrap}>
        <span style={searchIcon}>&#128269;</span>
        <input
          type="text"
          placeholder="Search by name, region, or cuisine..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
        {search && (
          <button onClick={() => setSearch("")} style={clearBtn}>
            &#10005;
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div style={chipRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setDifficulty(f)}
            style={{
              ...chip,
              background: difficulty === f ? "#e85d04" : "#f5f5f5",
              color: difficulty === f ? "white" : "#555",
              fontWeight: difficulty === f ? 600 : 400,
            }}
          >
            {f === "All" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <p style={{ color: "#888", textAlign: "center", padding: "2rem" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#888", textAlign: "center", padding: "2rem" }}>
          No recipes found. Try a different search or filter.
        </p>
      ) : (
        <div style={grid}>
          {filtered.map((r) => {
            const total = (r.prep_time || 0) + (r.cook_time || 0);
            return (
              <Link key={r.id} to={`/recipes/${r.id}`} style={card}>
                {/* Color accent bar */}
                <div
                  style={{
                    height: "4px",
                    borderRadius: "4px 4px 0 0",
                    background:
                      r.difficulty === "easy"
                        ? "#22c55e"
                        : r.difficulty === "medium"
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                />
                <div style={{ padding: "0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ fontSize: "1rem" }}>{r.name}</strong>
                      {r.name_hi && (
                        <div style={{ color: "#aaa", fontSize: "0.8rem", marginTop: "0.1rem" }}>{r.name_hi}</div>
                      )}
                    </div>
                  </div>
                  <div style={metaRow}>
                    {r.region && <span style={metaTag}>{r.region}</span>}
                    <span style={metaTag}>{r.difficulty}</span>
                    <span style={{ color: "#888", fontSize: "0.8rem" }}>{total} min</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = {
  padding: "1rem",
  maxWidth: "650px",
  margin: "0 auto",
};

const header: React.CSSProperties = {
  marginBottom: "1rem",
};

const searchWrap: React.CSSProperties = {
  position: "relative",
  marginBottom: "0.8rem",
};

const searchIcon: React.CSSProperties = {
  position: "absolute",
  left: "0.8rem",
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: "0.9rem",
  pointerEvents: "none",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 2.2rem 0.7rem 2.4rem",
  fontSize: "0.95rem",
  borderRadius: "24px",
  border: "1px solid #e0e0e0",
  outline: "none",
  background: "#fafafa",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const clearBtn: React.CSSProperties = {
  position: "absolute",
  right: "0.8rem",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  color: "#999",
  cursor: "pointer",
  fontSize: "0.85rem",
  padding: "0.2rem",
};

const chipRow: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  marginBottom: "1rem",
  overflowX: "auto",
};

const chip: React.CSSProperties = {
  padding: "0.35rem 0.9rem",
  borderRadius: "16px",
  border: "none",
  fontSize: "0.82rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "background 0.2s",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "0.7rem",
};

const card: React.CSSProperties = {
  display: "block",
  border: "1px solid #eee",
  borderRadius: "10px",
  textDecoration: "none",
  color: "inherit",
  overflow: "hidden",
  transition: "box-shadow 0.2s, transform 0.2s",
  background: "white",
};

const metaRow: React.CSSProperties = {
  display: "flex",
  gap: "0.4rem",
  alignItems: "center",
  marginTop: "0.5rem",
  flexWrap: "wrap",
};

const metaTag: React.CSSProperties = {
  fontSize: "0.75rem",
  background: "#f5f5f5",
  padding: "0.15rem 0.5rem",
  borderRadius: "10px",
  color: "#666",
};
