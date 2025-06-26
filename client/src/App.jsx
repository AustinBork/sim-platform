// client/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import caseData from '../../server/caseData.json';
import {
  applyAction,
  canAccuse,
  fmt,
} from './gameEngine';

const MODES = {
  Easy:    'Navarro will proactively hint and nudge you along.',
  Classic: 'Navarro only reminds or reframes what’s known when asked.',
  Hard:    'Navarro defers to you—minimal guidance unless explicitly requested.',
};

const ACTION_COSTS = {
  travel:    10,
  interview: 20,
  followUp:  10
};

// High-level intent keywords for auto-staging
const INTENT_VERBS = ['knock', 'walk', 'go to', 'head to', 'approach', 'talk to', 'visit', 'ask'];

export default function App() {
  const START_OF_DAY = 7 * 60 + 50; // 7:50 AM
  const LOCATION = "Mia's Apartment";

  // State
  const [phase, setPhase]                     = useState('pregame');
  const [detectiveName, setDetectiveName]     = useState('');
  const [mode, setMode]                       = useState('Classic');
  const [msgs, setMsgs]                       = useState([]); // { speaker, content }
  const [input, setInput]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [timeElapsed, setTimeElapsed]         = useState(0);
  const [timeRemaining, setTimeRemaining]     = useState(48 * 60);
  const [evidence, setEvidence]               = useState([]);
  const [leads, setLeads]                     = useState([]);
  const [interviewCounts, setInterviewCounts] = useState({});
  const [seenNpcInterviewed, setSeenNpcInterviewed] = useState({});
  const [showNotepad, setShowNotepad]         = useState(false);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState('');
  const [hasSave, setHasSave]                 = useState(false);
  const [savedState, setSavedState]           = useState(null);
  const scrollRef                             = useRef(null);

  // On mount: check for save
  useEffect(() => {
    const raw = localStorage.getItem('first48_save');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        setHasSave(true);
        setSavedState(s);
      } catch {}
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, showAccuseModal]);

  const currentClock = () => START_OF_DAY + timeElapsed;

  // Save current state
  const saveGame = () => {
    const toSave = {
      detectiveName,
      mode,
      phase,
      msgs,
      timeElapsed,
      timeRemaining,
      evidence,
      leads,
      interviewCounts,
      seenNpcInterviewed
    };
    localStorage.setItem('first48_save', JSON.stringify(toSave));
    setHasSave(true);
    setSavedState(toSave);
  };

  // Load saved state
  const loadGame = () => {
    if (!savedState) return;
    setDetectiveName(savedState.detectiveName);
    setMode(savedState.mode);
    setPhase(savedState.phase);
    setMsgs(savedState.msgs);
    setTimeElapsed(savedState.timeElapsed);
    setTimeRemaining(savedState.timeRemaining);
    setEvidence(savedState.evidence);
    setLeads(savedState.leads);
    setInterviewCounts(savedState.interviewCounts);
    setSeenNpcInterviewed(savedState.seenNpcInterviewed || {});
  };

  // Begin new investigation
  const startGame = () => {
    if (!detectiveName.trim()) return;
    const intro = `*You step under the yellow tape into Mia Rodriguez’s apartment, Detective ${detectiveName}.*  
“Detective ${detectiveName}, Mia was found stabbed this morning—no forced entry, knife still in situ.  
Our neighbor, Marvin Lott, called it in after hearing something around 3:30 AM.  
Up to you where we start.”`;
    setMsgs([{ speaker: 'System', content: intro }]);
    setPhase('chat');
    setTimeElapsed(0);
    setTimeRemaining(48 * 60);
    setEvidence([]);
    setLeads([]);
    setInterviewCounts({});
    setSeenNpcInterviewed({});
  };

  // Send Action / Message
  const sendMessage = async () => {
    const actionText = input.trim();
    if (!actionText) return;
    setInput('');

    // Append detective’s message
    setMsgs(m => [...m, { speaker: detectiveName, content: actionText }]);

    // Stage-direction auto-staging
    if (INTENT_VERBS.some(v => actionText.toLowerCase().includes(v))) {
      const desc = `*You and Navarro ${actionText.replace(/\*/g, '')}.*`;
      setMsgs(m => [...m, { speaker: 'System', content: desc }]);
      setTimeElapsed(te => te + ACTION_COSTS.travel);
      setTimeRemaining(tr => tr - ACTION_COSTS.travel);
      setMsgs(m => [...m, { speaker: 'System', content: `⏱️ You spent ${ACTION_COSTS.travel} minutes traveling.` }]);
    }

    setLoading(true);

    // Build GPT history
    const history = [...msgs, { speaker: detectiveName, content: actionText }].map(m => ({
      role: m.speaker === 'Navarro' ? 'assistant'
           : m.speaker === 'System'  ? 'system'
           : 'user',
      content: m.content
    }));

    try {
      const res = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          gameState: {
            currentTime: fmt(currentClock()),
            timeRemaining: fmt(timeRemaining),
            location: LOCATION,
            mode,
            evidence,
            leads,
          }
        }),
      });
      const { text } = await res.json();

      // Clean and detect speaker
      let raw = text.trim();
      const lines = raw
        .split('\n')
        .filter(l => !l.startsWith(`Detective ${detectiveName}:`));
      const cleaned = lines.join('\n') || '[Navarro is thinking…]';
      const firstLine = cleaned.split('\n')[0];
      const match = firstLine.match(/^([^:]+):/);
      let speaker = 'Navarro';
      let content = cleaned;
      if (match) {
        const name = match[1].trim();
        if (caseData.suspects.includes(name)) {
          speaker = name;
          content = cleaned.replace(/^.*?:\s*/, '');
        }
      }

      // Append NPC or Navarro reply
      setMsgs(m => [...m, { speaker, content }]);

      // Auto-interview deduction on NPC first appearance
      if (speaker !== 'Navarro' && !seenNpcInterviewed[speaker]) {
        setTimeElapsed(te => te + ACTION_COSTS.interview);
        setTimeRemaining(tr => tr - ACTION_COSTS.interview);
        setMsgs(m => [...m, {
          speaker: 'System',
          content: `⏱️ You spent ${ACTION_COSTS.interview} minutes interviewing ${speaker}.`
        }]);
        setSeenNpcInterviewed(prev => ({ ...prev, [speaker]: true }));
        setInterviewCounts(prev => ({ ...prev, [speaker]: 0 }));
      }

    } catch (err) {
      setMsgs(m => [...m, { speaker: 'Navarro', content: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Accusation handlers
  const handleAccuse = () => {
    const { allowed, reason } = canAccuse({ timeElapsed });
    if (!allowed) {
      setMsgs(m => [...m, { speaker: 'Navarro', content: `❌ ${reason}` }]);
      return;
    }
    setShowAccuseModal(true);
  };
  const submitAccusation = () => {
    const correct = selectedSuspect === caseData.solution;
    const ep = correct ? caseData.epilogues.win : caseData.epilogues.lose;
    setMsgs(m => [...m, { speaker: 'Navarro', content: `*You accuse ${selectedSuspect}.*\n\n${ep}` }]);
    setShowAccuseModal(false);
  };

  // Render
  if (phase === 'pregame') {
    return (
      <div style={{ fontFamily:'sans-serif', maxWidth:600, margin:'2rem auto', padding:16 }}>
        <h1>First 48: The Simulation</h1>
        <p>You have 48 in-game hours to solve the homicide of Mia Rodriguez.</p>
        {hasSave && (
          <button
            onClick={() => { loadGame(); setPhase('chat'); }}
            style={{ margin:'8px 0', padding:8, background:'#4caf50', color:'#fff', border:'none', borderRadius:4 }}
          >
            Load Saved Game
          </button>
        )}
        <div style={{ marginTop:16 }}>
          <label>Detective Name:<br/>
            <input
              style={{ width:'100%', padding:8, marginTop:4 }}
              value={detectiveName}
              onChange={e => setDetectiveName(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginTop:16 }}>
          <label>Difficulty Mode:<br/>
            <select
              style={{ width:'100%', padding:8, marginTop:4 }}
              value={mode}
              onChange={e => setMode(e.target.value)}
            >
              {Object.keys(MODES).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <p style={{ fontStyle:'italic', marginTop:4 }}>{MODES[mode]}</p>
        </div>
        <button
          onClick={startGame}
          disabled={!detectiveName.trim()}
          style={{
            marginTop:24, padding:'10px 20px',
            background:'#3f51b5', color:'#fff',
            border:'none', borderRadius:4,
            cursor: detectiveName.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          {hasSave ? 'Load / Continue' : 'Begin New Investigation'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:'sans-serif', maxWidth:600, margin:'0 auto', padding:16 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div><strong>Time:</strong> {fmt(currentClock())} | <strong>Remaining:</strong> {fmt(timeRemaining)}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={saveGame} style={{ padding:'4px 8px', background:'#2196f3', color:'#fff', border:'none', borderRadius:4 }}>Save Game</button>
          <button onClick={handleAccuse} style={{
            padding:'4px 8px',
            background: canAccuse({ timeElapsed }).allowed ? '#d32f2f' : '#888',
            color:'#fff', border:'none', borderRadius:4, cursor:'pointer'
          }}>Accuse</button>
        </div>
      </div>

      {/* Message log */}
      <div style={{
        height:'50vh', overflowY:'auto',
        border:'1px solid #ccc', padding:12, marginBottom:12
      }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ margin:'8px 0' }}>
            <strong style={{ color: m.speaker==='Navarro' ? '#fc6': '#6cf'}}>{m.speaker}:</strong>
            <span style={{ whiteSpace:'pre-wrap' }}> {m.content}</span>
          </div>
        ))}
        {loading && <div>…thinking…</div>}
        <div ref={scrollRef}/> 
      </div>

      {/* Input bar */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input
          style={{ flex:1, padding:8, borderRadius:4, border:'1px solid #ccc'}}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && sendMessage()}
          placeholder="Ask Navarro or describe your next move…"
          disabled={loading || showAccuseModal}
        />
        <button onClick={sendMessage} disabled={loading || showAccuseModal}>Send</button>
        <button onClick={()=>setShowNotepad(true)}>🗒️ Notepad</button>
      </div>

      {/* Notepad */}
      {showNotepad && (
        <div style={{
          position:'fixed', top:80, left:'50%',
          transform:'translateX(-50%)', width:'90%',
          maxWidth:600, background:'#fff',
          border:'1px solid #666', borderRadius:4,
          padding:16, zIndex:1000
        }}>
          <h2>🗒️ Detective’s Notes</h2>
          <ul>
            <li>Bag the bloodstain for evidence</li>
            <li>Photograph the room</li>
            <li>Interview Marvin Lott</li>
          </ul>
          <p>You’re limited to 8 AM–9 PM for interviews.</p>
          <button onClick={()=>setShowNotepad(false)} style={{ padding:'6px 12px', background:'#007bff', color:'#fff', border:'none', borderRadius:4 }}>Close Notepad</button>
        </div>
      )}

      {/* Accusation Modal */}
      {showAccuseModal && (
        <div style={{
          position:'fixed', top:80, left:'50%',
          transform:'translateX(-50%)', width:'90%',
          maxWidth:400, background:'#fff',
          border:'1px solid #666', borderRadius:4,
          padding:16, zIndex:1000
        }}>
          <h2>🔍 Make Your Accusation</h2>
          <select value={selectedSuspect} onChange={e=>setSelectedSuspect(e.target.value)} style={{ width:'100%', padding:8, marginTop:8 }}>
            <option value="" disabled>Select Suspect…</option>
            {caseData.suspects.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={submitAccusation} disabled={!selectedSuspect} style={{ marginTop:12, padding:'8px 16px', background:'#d32f2f', color:'#fff', border:'none', borderRadius:4 }}>Confirm</button>
        </div>
      )}
    </div>
  );
}
