import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import RecipeList from "./pages/RecipeList";
import RecipeDetail from "./pages/RecipeDetail";
import CookingSession from "./pages/CookingSession";

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #eee" }}>
        <Link to="/" style={{ marginRight: "1rem", textDecoration: "none", fontWeight: "bold" }}>
          Home
        </Link>
        <Link to="/recipes" style={{ textDecoration: "none" }}>
          Recipes
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipes" element={<RecipeList />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/cook/:id" element={<CookingSession />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
