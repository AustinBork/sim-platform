// src/components/SimulationView.jsx
import React, { useState } from "react";
import { useGameState } from "../context/GameStateContext.jsx";
import NotepadPanel from "./NotepadPanel";
import { callClaude } from "../utils/ClaudeFetch"; // ✅ Ensure this exists


export default function SimulationView() {
  const { state, addDialogue } = useGameState();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // ⏳ Loading state

  const handleInput = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = `You: ${input}`;
    addDialogue(userMessage);
    setInput("");
    setLoading(true);

    try {
      const response = await callClaude(input);
      const reply = response || "[Claude didn't respond]";
      addDialogue(`Navarro: ${reply}`);
    } catch (err) {
      addDialogue("[ERROR] Failed to reach Claude.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "monospace" }}>
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>
        <div style={{ whiteSpace: "pre-wrap", marginBottom: "1rem" }}>
          {state.log.map((entry, index) => (
            <div key={index}>{entry}</div>
          ))}
        </div>
        <form onSubmit={handleInput}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={loading ? "Waiting for Navarro..." : "What do you want to do?"}
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              fontFamily: "inherit",
              opacity: loading ? 0.6 : 1,
            }}
          />
        </form>
      </div>
      <NotepadPanel />
    </div>
  );
}
