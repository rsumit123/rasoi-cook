import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import RecipeList from "./pages/RecipeList";
import RecipeDetail from "./pages/RecipeDetail";
import CookingSession from "./pages/CookingSession";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/" className="nav-brand">
          Rasoi
        </Link>
        <Link to="/recipes" className="nav-link">
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
