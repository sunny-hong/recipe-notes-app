import { Link } from "react-router";

import type { Route } from "./+types/dashboard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "recipe-notes-app" },
    { name: "description", content: "recipe-notes-app is a web application" },
  ];
}

export default function Home() {
  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{
        background: "linear-gradient(to bottom, #5DB5FC, #ABC4FF, #63CBFF)",
      }}
    >
      <div className="flex gap-8">
        {/* Notes */}
        <Link
          to="/"
          className="flex items-center justify-center"
          style={{
            width: 180,
            height: 180,
            borderRadius: 7,
            background: "#E6B55A",
            border: "2px solid #574420",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 18,
              fontWeight: "bold",
              textTransform: "uppercase",
              color: "#574420",
              letterSpacing: "0.05em",
            }}
          >
            Notes
          </span>
        </Link>

        {/* Recipe Generator */}
        <button
          className="flex items-center justify-center"
          style={{
            width: 180,
            height: 180,
            borderRadius: 7,
            background: "#7BC46E",
            border: "2px solid #3C7332",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 18,
              fontWeight: "bold",
              textTransform: "uppercase",
              color: "#3C7332",
              letterSpacing: "0.05em",
            }}
          >
            Recipe Generator
          </span>
        </button>
      </div>
    </div>
  );
}
