import React from 'react';
import { useNavigate } from 'react-router-dom';

const SimulationCard = ({ title, description, id }) => {
  const navigate = useNavigate();

  return (
    <div onClick={() => navigate(`/simulation/${id}`)} style={{ cursor: 'pointer', border: '1px solid gray', padding: '16px', margin: '8px' }}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
};

export default SimulationCard;
