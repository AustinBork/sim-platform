import React from 'react';
import SimulationCard from '../components/SimulationCard';

const Home = () => {
  return (
    <div>
      <h1>Select a Simulation</h1>
      <SimulationCard
        title="First 48: The Simulation"
        description="You have 48 hours to solve a murder case with limited time, realism, and freedom of choice."
        id="first-48"
      />
    </div>
  );
};

export default Home;
