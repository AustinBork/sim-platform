import React, { useState, useRef, useEffect, useCallback } from 'react';
import './EvidenceBoard.css';

const EvidenceBoard = ({ evidence, leads, suspects, theoryBoardState, onStateChange, onClose }) => {
  // Use persistent state from parent
  const { cards: persistentCards, connections: persistentConnections, boardScale: persistentScale, boardOffset: persistentOffset } = theoryBoardState;
  
  const [cards, setCards] = useState(persistentCards || []);
  const [connections, setConnections] = useState(persistentConnections || []);
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const [cardScale, setCardScale] = useState(1); // Scale for card size instead of board zoom
  
  const boardRef = useRef(null);
  const svgRef = useRef(null);
  const workspaceRef = useRef(null);

  // Sync state changes back to parent
  useEffect(() => {
    onStateChange({
      cards,
      connections,
      cardScale
    });
  }, [cards, connections, cardScale, onStateChange]);

  // Initialize cards from evidence and leads (only if not already persisted)
  useEffect(() => {
    setCards(prevCards => {
      // Only initialize cards if we don't have persistent cards or if new evidence/leads are available
      const existingCardIds = prevCards.map(card => card.id);
      
      const newCards = [
        // Evidence cards
        ...evidence.map((evidenceId, index) => ({
          id: `evidence-${evidenceId}`,
          type: 'evidence',
          title: evidenceId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          content: getEvidenceDescription(evidenceId),
          position: {
            x: 100 + (index % 3) * 220,
            y: 100 + Math.floor(index / 3) * 150
          }
        })),
        // Lead cards
        ...leads.map((leadId, index) => ({
          id: `lead-${leadId}`,
          type: 'lead',
          title: leadId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          content: getLeadDescription(leadId),
          position: {
            x: 100 + (index % 3) * 220,
            y: 400 + Math.floor(index / 3) * 150
          }
        })),
        // Suspect cards
        ...suspects.map((suspect, index) => ({
          id: `suspect-${suspect.replace(/\s+/g, '-')}`,
          type: 'suspect',
          title: suspect,
          content: `Suspect: ${suspect}`,
          position: {
            x: 100 + (index % 3) * 220,
            y: 700 + Math.floor(index / 3) * 150
          }
        }))
      ];
      
      // Only add cards that don't already exist
      const cardsToAdd = newCards.filter(newCard => !existingCardIds.includes(newCard.id));
      
      if (cardsToAdd.length > 0) {
        return [...prevCards, ...cardsToAdd];
      }
      
      return prevCards;
    });
  }, [evidence, leads, suspects]);

  // Helper functions to get descriptions
  const getEvidenceDescription = (evidenceId) => {
    const descriptions = {
      'stab-wound': 'Single precise thrust wound',
      'no-forced-entry': 'No signs of breaking and entering',
      'partial-cleaning': 'Someone cleaned up after themselves',
      'missing-phone': 'Victim\'s phone is missing',
      'locked-door': 'Door locked from inside',
      'bloodstain': 'Unusual blood spatter pattern',
      'bracelet-charm': 'Small charm from bracelet'
    };
    return descriptions[evidenceId] || evidenceId;
  };

  const getLeadDescription = (leadId) => {
    const descriptions = {
      'scene-photos': 'Crime scene photography',
      'victim-background': 'Victim background research',
      'blood-analysis': 'Forensic blood analysis',
      'knife-analysis': 'Murder weapon analysis',
      'phone-records': 'Phone communication records'
    };
    return descriptions[leadId] || leadId;
  };

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback((e, card) => {
    e.preventDefault();
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDraggedCard(card);
    setDragOffset({
      x: x - card.position.x,
      y: y - card.position.y
    });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggedCard) {
      // Update card position
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;
      
      setCards(prev => prev.map(card => 
        card.id === draggedCard.id 
          ? { ...card, position: { x: newX, y: newY } }
          : card
      ));
    } else if (connectingFrom) {
      // Update drag line for connection - simple coordinates
      setDragLine({
        x1: connectingFrom.position.x + (100 * cardScale),
        y1: connectingFrom.position.y + (75 * cardScale),
        x2: x,
        y2: y
      });
    }
  }, [draggedCard, dragOffset, connectingFrom, cardScale]);

  const handleMouseUp = useCallback((e) => {
    if (draggedCard) {
      setDraggedCard(null);
    }
    
    if (connectingFrom) {
      // Check if we're over another card
      const rect = boardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const targetCard = cards.find(card => 
        card.id !== connectingFrom.id &&
        x >= card.position.x && x <= card.position.x + (200 * cardScale) &&
        y >= card.position.y && y <= card.position.y + (150 * cardScale)
      );
      
      if (targetCard) {
        // Create connection
        const connectionId = `${connectingFrom.id}-${targetCard.id}`;
        const reverseConnectionId = `${targetCard.id}-${connectingFrom.id}`;
        
        // Check if connection already exists
        const existingConnection = connections.find(
          conn => conn.id === connectionId || conn.id === reverseConnectionId
        );
        
        if (!existingConnection) {
          const newConnection = {
            id: connectionId,
            from: connectingFrom.id,
            to: targetCard.id,
            fromPos: { x: connectingFrom.position.x + (100 * cardScale), y: connectingFrom.position.y + (75 * cardScale) },
            toPos: { x: targetCard.position.x + (100 * cardScale), y: targetCard.position.y + (75 * cardScale) }
          };
          setConnections(prev => [...prev, newConnection]);
        }
      }
      
      setConnectingFrom(null);
      setDragLine(null);
    }
  }, [draggedCard, connectingFrom, cards, connections, cardScale]);

  // Add global event listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Update connection positions when cards move or scale changes
  useEffect(() => {
    setConnections(prev => prev.map(conn => {
      const fromCard = cards.find(card => card.id === conn.from);
      const toCard = cards.find(card => card.id === conn.to);
      
      if (fromCard && toCard) {
        return {
          ...conn,
          fromPos: { x: fromCard.position.x + (100 * cardScale), y: fromCard.position.y + (75 * cardScale) },
          toPos: { x: toCard.position.x + (100 * cardScale), y: toCard.position.y + (75 * cardScale) }
        };
      }
      return conn;
    }));
  }, [cards, cardScale]);

  // Handle right-click to start connection
  const handleRightClick = useCallback((e, card) => {
    e.preventDefault();
    setConnectingFrom(card);
  }, []);

  // Handle connection deletion
  const handleConnectionClick = useCallback((connectionId) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  }, []);

  // Card size handlers
  const increaseCardSize = useCallback(() => {
    setCardScale(prev => Math.min(2, prev + 0.1));
  }, []);
  
  const decreaseCardSize = useCallback(() => {
    setCardScale(prev => Math.max(0.3, prev - 0.1));
  }, []);
  
  const resetCardSize = useCallback(() => {
    setCardScale(1);
  }, []);

  return (
    <div className="evidence-board-overlay">
      <div className="evidence-board-container">
        <div className="evidence-board-header">
          <h2>🔍 Detective Theory Board</h2>
          <div className="board-stats">
            <span>📋 Evidence: {evidence.length}</span>
            <span>🔍 Leads: {leads.length}</span>
            <span>👥 Suspects: {suspects.length}</span>
            <span>🧵 Connections: {connections.length}</span>
          </div>
          <div className="board-controls" data-testid="scale-controls">
            <button data-testid="zoom-out" onClick={decreaseCardSize}>📦 Smaller Cards</button>
            <button data-testid="reset-board" onClick={resetCardSize}>Reset Size</button>
            <button data-testid="zoom-in" onClick={increaseCardSize}>🔍 Larger Cards</button>
            <button onClick={() => setConnections([])}>Clear Connections</button>
            <button data-testid="close-evidence-board" onClick={onClose}>Close</button>
          </div>
        </div>
        
        <div 
          ref={boardRef}
          className="evidence-board"
          data-testid="evidence-board"
        >
          <div 
            ref={workspaceRef}
            className="evidence-board-workspace"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              minWidth: '2000px',
              minHeight: '2000px'
            }}
          >
          {/* Cork board background */}
          <div className="cork-board-background" />
          
          {/* Connection mode indicator */}
          {connectingFrom && (
            <div className="connection-mode-indicator" data-testid="connection-mode-indicator">
              Connecting from: {connectingFrom.title}
            </div>
          )}
          
          {/* Empty state message */}
          {evidence.length === 0 && leads.length === 0 && suspects.length === 0 && (
            <div className="empty-state" style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              color: '#666',
              fontSize: '18px'
            }}>
              No evidence collected yet. Start investigating!
            </div>
          )}
          
          {/* SVG layer for connections */}
          <svg 
            ref={svgRef}
            className="connection-layer"
            width="100%" 
            height="100%"
          >
            {/* Render connections */}
            {connections.map(conn => (
              <g key={conn.id}>
                <line
                  x1={conn.fromPos.x}
                  y1={conn.fromPos.y}
                  x2={conn.toPos.x}
                  y2={conn.toPos.y}
                  stroke="#cc2936"
                  strokeWidth="3"
                  strokeDasharray="5,3"
                  className="connection-line"
                  onClick={() => handleConnectionClick(conn.id)}
                />
                <circle
                  cx={conn.fromPos.x}
                  cy={conn.fromPos.y}
                  r="4"
                  fill="#cc2936"
                />
                <circle
                  cx={conn.toPos.x}
                  cy={conn.toPos.y}
                  r="4"
                  fill="#cc2936"
                />
              </g>
            ))}
            
            {/* Render drag line */}
            {dragLine && (
              <line
                x1={dragLine.x1}
                y1={dragLine.y1}
                x2={dragLine.x2}
                y2={dragLine.y2}
                stroke="#cc2936"
                strokeWidth="2"
                strokeDasharray="3,3"
                opacity="0.7"
              />
            )}
          </svg>
          
          {/* Evidence cards */}
          {cards.map(card => (
            <div
              key={card.id}
              className={`evidence-card ${card.type} ${draggedCard?.id === card.id ? 'dragging' : ''}`}
              data-testid={`card-${card.id}`}
              style={{
                left: card.position.x,
                top: card.position.y,
                transform: `scale(${cardScale})`,
                transformOrigin: 'top left',
                zIndex: draggedCard?.id === card.id ? 1000 : 1
              }}
              onMouseDown={(e) => handleMouseDown(e, card)}
              onContextMenu={(e) => handleRightClick(e, card)}
            >
              <div className="card-header">
                <span className="card-type">{card.type}</span>
                <span className="card-title">{card.title}</span>
                <button 
                  data-testid={`connect-button-${card.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectingFrom === card) {
                      setConnectingFrom(null);
                    } else if (connectingFrom) {
                      // Create connection
                      handleCardClick(card);
                    } else {
                      setConnectingFrom(card);
                    }
                  }}
                  style={{ 
                    position: 'absolute', 
                    top: '2px', 
                    right: '2px',
                    background: connectingFrom === card ? '#ff4444' : '#4caf50',
                    border: 'none',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🔗
                </button>
              </div>
              <div className="card-content">
                {card.content}
              </div>
              <div className="card-connector" />
            </div>
          ))}
          </div>
        </div>
        
        <div className="evidence-board-instructions">
          <p><strong>🖱️ Left-click and drag</strong> to move cards around</p>
          <p><strong>🖱️ Right-click</strong> on a card, then click another to connect with red string</p>
          <p><strong>🖱️ Click red string</strong> to delete connection</p>
          <p><strong>📦 Use card size buttons</strong> to make cards smaller/larger</p>
        </div>
      </div>
    </div>
  );
};

export default EvidenceBoard;