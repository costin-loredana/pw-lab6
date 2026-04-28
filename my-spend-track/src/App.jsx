import { useState, useEffect } from "react";
import "./App.css";

export default function App() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.body.className = theme === "dark" ? "dark-theme" : "";
  }, [theme]);

  return (
    <div className="container">
      <header>
        <div className="title-group">
          <p>Monitorizare Cheltuieli Personale</p>
          <h1>Registru</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </header>
    </div>
  );
}