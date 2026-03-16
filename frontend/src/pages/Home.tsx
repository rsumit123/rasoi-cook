import { Link } from "react-router-dom";

const FEATURES = [
  { icon: "\u{1F3A4}", title: "Voice-first", desc: "Talk naturally while cooking — hands stay clean" },
  { icon: "\u{1F1EE}\u{1F1F3}", title: "Indian languages", desc: "Hindi, English, Hinglish — speak however you're comfortable" },
  { icon: "\u{1F4F7}", title: "Snap ingredients", desc: "Point your camera at any ingredient to identify it" },
  { icon: "\u{1F468}\u200D\u{1F373}", title: "Mom-like guidance", desc: "Patient, step-by-step cooking help with tips & tricks" },
];

const POPULAR = [
  { id: 1, name: "Paneer Butter Masala", time: "50 min", difficulty: "medium" },
  { id: 2, name: "Dal Tadka", time: "35 min", difficulty: "easy" },
  { id: 9, name: "Maggi Noodles", time: "7 min", difficulty: "easy" },
  { id: 6, name: "Masala Dosa", time: "510 min", difficulty: "hard" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div style={hero}>
        <div style={heroContent}>
          <p style={heroLabel}>AI Cooking Assistant</p>
          <h1 style={heroTitle}>
            Rasoi <span style={{ color: "#e85d04" }}>.</span>
          </h1>
          <p style={heroSubtitle}>
            Your personal cooking guide for Indian recipes.
            <br />
            Just talk, and start cooking.
          </p>
          <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
            <Link to="/recipes" style={primaryBtn}>
              Start Cooking
            </Link>
            <a href="#features" style={secondaryBtn}>
              How it works
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" style={section}>
        <h2 style={sectionTitle}>Cook with confidence</h2>
        <div style={featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} style={featureCard}>
              <span style={{ fontSize: "1.8rem" }}>{f.icon}</span>
              <h3 style={{ fontSize: "1rem", margin: "0.5rem 0 0.2rem", fontWeight: 600 }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.4 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Popular recipes */}
      <div style={{ ...section, background: "#fafafa" }}>
        <h2 style={sectionTitle}>Popular recipes</h2>
        <div style={recipeRow}>
          {POPULAR.map((r) => (
            <Link key={r.id} to={`/recipes/${r.id}`} style={recipeChip}>
              <strong style={{ fontSize: "0.95rem" }}>{r.name}</strong>
              <span style={{ fontSize: "0.75rem", color: "#888" }}>
                {r.difficulty} &middot; {r.time}
              </span>
            </Link>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "1.2rem" }}>
          <Link to="/recipes" style={{ color: "#e85d04", fontWeight: 600, textDecoration: "none", fontSize: "0.95rem" }}>
            View all 13 recipes &rarr;
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={footer}>
        <p style={{ color: "#999", fontSize: "0.8rem" }}>
          Built with Sarvam AI &middot; Voice, vision, and conversation in every Indian language
        </p>
      </div>
    </div>
  );
}

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg, #fff7ed 0%, #fff 50%, #fef3c7 100%)",
  padding: "3rem 1.5rem 2.5rem",
  textAlign: "center",
};

const heroContent: React.CSSProperties = {
  maxWidth: "500px",
  margin: "0 auto",
};

const heroLabel: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#e85d04",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: "0.3rem",
};

const heroTitle: React.CSSProperties = {
  fontSize: "clamp(2.5rem, 8vw, 4rem)",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.1,
  color: "#1a1a1a",
};

const heroSubtitle: React.CSSProperties = {
  fontSize: "clamp(0.95rem, 2.5vw, 1.15rem)",
  color: "#666",
  marginTop: "0.8rem",
  lineHeight: 1.5,
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.8rem",
  background: "#e85d04",
  color: "white",
  borderRadius: "24px",
  textDecoration: "none",
  fontSize: "1rem",
  fontWeight: 600,
  boxShadow: "0 4px 14px rgba(232, 93, 4, 0.25)",
  transition: "transform 0.2s",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.8rem",
  background: "white",
  color: "#e85d04",
  borderRadius: "24px",
  textDecoration: "none",
  fontSize: "1rem",
  fontWeight: 600,
  border: "1.5px solid #e85d04",
};

const section: React.CSSProperties = {
  padding: "2.5rem 1.5rem",
  maxWidth: "700px",
  margin: "0 auto",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "1.4rem",
  fontWeight: 700,
  textAlign: "center",
  marginBottom: "1.5rem",
  letterSpacing: "-0.02em",
};

const featureGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
};

const featureCard: React.CSSProperties = {
  padding: "1.2rem 1rem",
  background: "#fff",
  borderRadius: "12px",
  border: "1px solid #f0f0f0",
  textAlign: "center",
};

const recipeRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.8rem",
};

const recipeChip: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
  padding: "1rem",
  background: "white",
  border: "1px solid #eee",
  borderRadius: "10px",
  textDecoration: "none",
  color: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  padding: "1.5rem",
  borderTop: "1px solid #f0f0f0",
};
