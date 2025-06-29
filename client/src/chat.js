// client/src/chat.js
import React, { useState, useEffect, useRef } from 'react';
import { applyAction, fmt, canAccuse } from './gameEngine';
import caseData from '../server/caseData.json';
import { leadDefinitions } from './gameEngine';

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(48 * 60);
  const [evidence, setEvidence] = useState([]);
  const [leads, setLeads] = useState([]);
  const [interviewCounts, setInterviewCounts] = useState({});
  const [actionsPerformed, setActionsPerformed] = useState([]);
  const [interviewsCompleted, setInterviewsCompleted] = useState([]);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState('');
  const [showNotepad, setShowNotepad] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll when messages or modals change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showAccuseModal, showNotepad]);

  // Handle a user action (e.g. "photograph the room")
  const handleAction = async () => {
    console.log('✅ Chat.handleAction about to call applyAction with:', input);
    if (!input.trim()) return;

    const actionText = input.trim();
    const gameState = {
      timeElapsed,
      timeRemaining,
      evidence,
      leads,
      interviewCounts,
      actionsPerformed,
      interviewsCompleted
    };

    const result = applyAction(gameState, actionText);
    console.log('✅ applyAction returned:', result);

    if (result.error) {
      setMessages(m => [...m, { role: 'bot', content: `❌ ${result.error}` } ]);
      setInput('');
      return;
    }

    const { newState, cost, newLeads } = result;
    console.log('🔔 Chat sees newLeads:', newLeads);
    console.log('🔔 Chat sees state.leads:', newState.leads);

    // Update all local state
    setTimeElapsed(newState.timeElapsed);
    setTimeRemaining(newState.timeRemaining);
    setEvidence(newState.evidence); // No evidence change in this step
    setLeads(newState.leads);
    setInterviewCounts(newState.interviewCounts);
    setActionsPerformed(newState.actionsPerformed);
    setInterviewsCompleted(newState.interviewsCompleted);

    // Append the user's message
    setMessages(m => [...m, { role: 'user', content: actionText }]);
    setInput('');
    setLoading(true);

    // Notify new leads in the chat log
    if (newLeads && newLeads.length) {
      newLeads.forEach(def => {
        setMessages(m => [...m, { role: 'system', content: `🕵️ New lead unlocked: ${def.description}` }]);
      });
    }

    // Proxy to GPT for dialogue/staging
    try {
      const payload = {
        messages: [...messages, { role: 'user', content: actionText }],
        gameState: {
          currentTime: fmt(timeElapsed + cost),
          timeRemaining: fmt(timeRemaining - cost),
          evidence,
          leads: newState.leads
        }
      };

      const res = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const { text } = await res.json();

      const lines = text.trim().split(/\r?\n/);
      const parsed = lines
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(obj => obj && (obj.type === 'stage' || obj.type === 'dialogue'));

      parsed.forEach(obj => {
        if (obj.type === 'stage') {
          setMessages(m => [...m, { role: 'system', content: `*${obj.description}*` }]);
        } else if (obj.type === 'dialogue') {
          setMessages(m => [...m, { role: 'npc', speaker: obj.speaker, content: obj.text }]);
        }
      });
    } catch (err) {
      setMessages(m => [...m, { role: 'bot', content: `❌ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Accusation handlers
  const handleAccuse = () => {
    const { allowed, reason } = canAccuse({ timeElapsed });
    if (!allowed) {
      setMessages(m => [...m, { role: 'bot', content: `❌ ${reason}` }]);
      return;
    }
    setShowAccuseModal(true);
  };

  const submitAccusation = () => {
    const correct = selectedSuspect === caseData.solution;
    const ep = correct ? caseData.epilogues.win : caseData.epilogues.lose;
    setMessages(m => [...m, { role: 'bot', content: `*Accusation*: You accuse ${selectedSuspect}.\n\n${ep}` }]);
    setShowAccuseModal(false);
  };

  // Render
  return (
    <div style={{ padding: 16, maxWidth: 600, margin: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div><strong>Time:</strong> {fmt(timeElapsed + 7*60+50)} | <strong>Remaining:</strong> {fmt(timeRemaining)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNotepad(true)} style={{ padding: '4px 8px' }}>🗒️ Notepad</button>
          <button onClick={handleAccuse} disabled={!canAccuse({ timeElapsed }).allowed} style={{ padding: '4px 8px' }}>Accuse</button>
        </div>
      </div>

      {/* Message Log */}
      <div style={{ height: 300, overflowY: 'auto', border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            {m.role === 'user' && <strong>You:</strong>}
            {m.role === 'bot' && <strong>System:</strong>}
            {m.role === 'system' && <em>{m.content}</em>}
            {m.role === 'npc' && <strong>{m.speaker}:</strong>}
            {' '}{m.content}
          </div>
        ))}
        {loading && <div>…thinking…</div>}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAction()}
          disabled={loading || showAccuseModal}
          placeholder="Ask Navarro or describe your next action..."
        />
        <button onClick={handleAction} disabled={loading || showAccuseModal} style={{ padding: '0 16px' }}>Send</button>
      </div>

      {/* Notepad Modal */}
      {showNotepad && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 600, background: '#fff', border: '1px solid #666', borderRadius: 4, padding:16, zIndex:1000 }}>
          <h2>🗒️ Detective’s Notes</h2>
          {leads.length > 0 ? (
            <ul>
              {leads.map(id => {
                const def = leadDefinitions.find(d => d.id === id);
                if (!def || def.isRedHerring) return null;
                return <li key={def.id}>{def.description}</li>;
              })}
            </ul>
          ) : (
            <p>No active leads yet.</p>
          )}
          <p style={{ fontSize: '0.9em', marginTop:8 }}>You’re limited to 8 AM–9 PM for interviews.</p>
          <button onClick={() => setShowNotepad(false)} style={{ padding:'6px 12px', background:'#007bff', color:'#fff', border:'none', borderRadius:4 }}>Close Notepad</button>
        </div>
      )}

      {/* Accusation Modal */}
      {showAccuseModal && (
        <div style={{ position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', width:'90%', maxWidth:400, background:'#fff', border:'1px solid #666', borderRadius:4, padding:16, zIndex:1000 }}>
          <h2>🔍 Make Your Accusation</h2>
          <select value={selectedSuspect} onChange={e => setSelectedSuspect(e.target.value)} style={{ width:'100%', padding:8, marginTop:8 }}>
            <option value="" disabled>Select Suspect…</option>
            {caseData.suspects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={submitAccusation} disabled={!selectedSuspect} style={{ marginTop:12, padding:'8px 16px', background:'#d32f2f', color:'#fff', border:'none', borderRadius:4 }}>Confirm</button>
        </div>
      )}
    </div>
  );
}
