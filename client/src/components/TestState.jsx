import React from "react";
import { useGameState } from "../context/GameStateContext.jsx";

export default function TestState() {
  const { state, updateTime, addFlag } = useGameState();

  return (
    <div>
      <h2>🕒 Time Remaining: {state.timeRemaining} minutes</h2>
      <h2>📍 Location: {state.currentLocation}</h2>
      <button onClick={() => updateTime(15)}>Pass 15 Minutes</button>
      <button onClick={() => addFlag("testFlag")}>Add Flag</button>
      <pre>{JSON.stringify(state.flags, null, 2)}</pre>
    </div>
  );
}
