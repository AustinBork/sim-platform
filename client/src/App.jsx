import React from "react";
import SimulationView from "./components/SimulationView";
import { GameStateProvider } from "./context/GameStateContext";

function App() {
  return (
    <GameStateProvider>
      <SimulationView />
    </GameStateProvider>
  );
}

export default App;
