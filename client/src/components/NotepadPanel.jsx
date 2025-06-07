// src/components/NotepadPanel.jsx
import React from "react";
import { useGameState } from "../context/GameStateContext.jsx";

export default function NotepadPanel({ isOpen, setIsOpen }) {
  const { state } = useGameState();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          background: "#222",
          color: "#fff",
          border: "none",
          padding: "0.5rem",
          cursor: "pointer",
        }}
      >
        Open Notepad
      </button>
    );
  }

  return (
    <div style={{ width: "30%", background: "#1a1a1a", color: "#fff", padding: "1rem", overflowY: "auto" }}>
      <button
        onClick={() => setIsOpen(false)}
        style={{
          background: "#444",
          color: "#fff",
          border: "none",
          padding: "0.5rem 1rem",
          cursor: "pointer",
          marginBottom: "1rem",
        }}
      >
        Close Notepad
      </button>
      <h2 style={{ borderBottom: "1px solid #555" }}>NOTEPAD</h2>

      <h3>Current Location</h3>
      <p>{state.currentLocation}</p>

      <h3>Evidence Collected</h3>
      <ul>
        {state.evidenceCollected.length === 0 ? (
          <li>None yet</li>
        ) : (
          state.evidenceCollected.map((item, i) => <li key={i}>{item}</li>)
        )}
      </ul>

      <h3>Dialogue History</h3>
      <ul>
        {state.dialogueHistory.slice(-5).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
