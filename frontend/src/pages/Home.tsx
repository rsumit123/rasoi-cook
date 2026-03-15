import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
      <h1>AI Cooking Assistant</h1>
      <p style={{ fontSize: "1.2rem", color: "#666", margin: "1rem 0" }}>
        Your voice-first cooking guide for Indian recipes
      </p>
      <Link
        to="/recipes"
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
        Browse Recipes
      </Link>
    </div>
  );
}
