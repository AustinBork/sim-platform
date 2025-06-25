// src/App.jsx
import React from 'react';
import Chat from './Chat';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold text-center pt-8">
        First 48 Simulation
      </h1>
      <Chat />
    </div>
  );
}
