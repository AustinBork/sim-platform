// client/src/chat.js
import React, { useState, useRef, useEffect } from 'react';
import { applyAction, fmt, canAccuse } from './gameEngine';
import caseData from '../server/caseData.json'; // ensure this path or copy JSON into client

export default function Chat() {
  // Chat + game state
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(48 * 60);
  const [evidence, setEvidence] = useState([]);
  const [leads, setLeads] = useState([]);
  const [interviewCounts, setInterviewCounts] = useState({});
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showAccuseModal]);

  const handleAction = async () => {
    if (!input.trim()) return;

    const actionText = input.trim();
    const gameState = { timeElapsed, timeRemaining, evidence, leads, interviewCounts };
    const result = applyAction(gameState, actionText);

    if (result.error) {
      setMessages(m => [...m, { from: 'bot', text: `❌ ${result.error}` }]);
      setInput('');
      return;
    }

    const { newState, cost } = result;
    setTimeElapsed(newState.timeElapsed);
    setTimeRemaining(newState.timeRemaining);
    setLeads(newState.leads);
    setInterviewCounts(newState.interviewCounts);

    setMessages(m => [...m, { from: 'user', text: actionText }]);
    setInput('');
    setLoading(true);

    const payload = {
      messages: [...messages, { from: 'user', text: actionText }],
      gameState: {
        currentTime: fmt(timeElapsed + cost),
        timeRemaining: fmt(timeRemaining - cost),
        evidence,
        leads: newState.leads,
      }
    };

    try {
      const res = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const { text } = await res.json();
      setMessages(m => [...m, { from: 'bot', text }]);
    } catch (err) {
      setMessages(m => [...m, { from: 'bot', text: `❌ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccuse = () => {
    const { allowed, reason } = canAccuse({ timeElapsed });
    if (!allowed) {
      setMessages(m => [...m, { from: 'bot', text: `❌ ${reason}` }]);
      return;
    }
    setShowAccuseModal(true);
  };

  const submitAccusation = () => {
    const correct = selectedSuspect === caseData.solution;
    const epilogue = correct ? caseData.epilogues.win : caseData.epilogues.lose;
    setMessages(m => [...m, { from: 'bot', text: `*Accusation*: You accuse ${selectedSuspect}.

${epilogue}` }]);
    setShowAccuseModal(false);
  };

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <strong>Time:</strong> {fmt(7 * 60 + 50 + timeElapsed)} | <strong>Remaining:</strong> {fmt(timeRemaining)}
        </div>
        <button onClick={handleAccuse} disabled={!canAccuse({ timeElapsed }).allowed} style={{ padding: '4px 8px' }}>
          Accuse
        </button>
      </div>

      <div style={{ height: 300, overflowY: 'auto', border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            <strong>{m.from === 'user' ? 'You' : 'Navarro'}:</strong> {m.text}
          </div>
        ))}
        {loading && <div>…thinking…</div>}
        <div ref={scrollRef} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAction()}
          disabled={loading || showAccuseModal}
          placeholder="Ask Navarro or take your next action..."
        />
        <button onClick={handleAction} disabled={loading || showAccuseModal} style={{ padding: '0 16px' }}>
          Send
        </button>
      </div>

      {showAccuseModal && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 400, background: '#fff', border: '1px solid #666', borderRadius: 4, padding: 16, zIndex: 1000 }}>
          <h2>🔍 Make Your Accusation</h2>
          <label>
            Select Suspect:<br />
            <select value={selectedSuspect} onChange={e => setSelectedSuspect(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 8 }}>
              <option value="" disabled>Select...</option>
              {caseData.suspects.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
          <button onClick={submitAccusation} disabled={!selectedSuspect} style={{ marginTop: 12, padding: '8px 16px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 4 }}>
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
