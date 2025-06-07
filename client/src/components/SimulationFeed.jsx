// src/components/SimulationFeed.jsx
import React from 'react';
import { useGameState } from '../context/game_state_context';

export default function SimulationFeed() {
  const { state } = useGameState();

  return (
    <div style={{ height: '70vh', overflowY: 'auto', background: '#111', color: '#eee', padding: '1rem', borderRadius: '8px' }}>
      {state.log.map((entry, index) => (
        <div key={index} style={{ marginBottom: '0.5rem' }}>{entry}</div>
      ))}
    </div>
  );
}
