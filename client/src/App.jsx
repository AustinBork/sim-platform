// client/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { leadDefinitions, applyAction, canAccuse, fmt } from './gameEngine';
import caseData from '../../server/caseData.json';

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

const INTENT_VERBS = ['knock', 'walk', 'go to', 'head to', 'approach', 'talk to', 'visit', 'ask'];

export default function App() {
  const START_OF_DAY = 7 * 60 + 50; // 7:50 AM
  const LOCATION     = "Mia's Apartment";

  // —— STATE DECLARATIONS ——
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

  // —— DERIVED NOTES STATE ——
  const [notes, setNotes] = useState([]);
  useEffect(() => {
    const unlocked = leadDefinitions
      .filter(d => leads.includes(d.id) && !d.isRedHerring)
      .map(d => d.description);
    setNotes(unlocked);
  }, [leads]);

  // —— ON MOUNT: LOAD SAVE —— 
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

  // —— AUTO-SCROLL —— 
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, showAccuseModal, showNotepad]);

  const currentClock = () => START_OF_DAY + timeElapsed;

  // —— SAVE / LOAD GAME ——
  const saveGame = () => {
    const toSave = { detectiveName, mode, phase, msgs, timeElapsed, timeRemaining, evidence, leads, interviewCounts, seenNpcInterviewed };
    localStorage.setItem('first48_save', JSON.stringify(toSave));
    setHasSave(true);
    setSavedState(toSave);
  };
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

  // —— START NEW INVESTIGATION ——
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

  // —— SEND ACTION / MESSAGE ——
  const sendMessage = async () => {
    const actionText = input.trim();
    console.log('✅ App.sendMessage: about to call applyAction with:', actionText);
    if (!actionText) return;
    setInput('');

    // call gameEngine
    const result = applyAction({ timeElapsed, timeRemaining, evidence, leads, interviewCounts, actionsPerformed: [], interviewsCompleted: [] }, actionText);
    console.log('✅ App.sendMessage applyAction returned:', result);
    if (result.error) {
      setMsgs(m => [...m, { speaker: 'System', content: `❌ ${result.error}` }]);
      return;
    }

    const { newState, cost, newLeads } = result;
    setTimeElapsed(newState.timeElapsed);
    setTimeRemaining(newState.timeRemaining);
    setEvidence(newState.evidence);
    setLeads(newState.leads);
    setInterviewCounts(newState.interviewCounts);

    setMsgs(m => [...m, { speaker: detectiveName, content: actionText }]);
    setLoading(true);

    // Announce any newly unlocked leads
    if (newLeads.length) {
      newLeads.forEach(def => {
        setMsgs(m => [...m, { speaker: 'System', content: `🕵️ New lead unlocked: ${def.description}` }]);
      });
    }

    // Send off to your proxy...
    try {
      const history = [...msgs, { speaker: detectiveName, content: actionText }].map(m => ({
        role: m.speaker === 'System' ? 'system'
             : m.speaker === detectiveName ? 'user'
             : 'assistant',
        content: m.content
      }));
      const res = await fetch('http://localhost:3001/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
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
        })
      });
      const { text } = await res.json();
      const lines = text.trim().split(/\r?\n/);
      const parsed = lines.map(l=>{ try{return JSON.parse(l)}catch{return null}}).filter(o=>o&&(['stage','dialogue'].includes(o.type)));
      for (const obj of parsed) {
        if (obj.type === 'stage') {
          setMsgs(m => [...m, { speaker: 'System', content: `*${obj.description}*` }]);
        } else {
          setMsgs(m => [...m, { speaker: obj.speaker, content: obj.text }]);
          if (obj.speaker !== 'Navarro' && !seenNpcInterviewed[obj.speaker]) {
            setTimeElapsed(te => te + ACTION_COSTS.interview);
            setTimeRemaining(tr => tr - ACTION_COSTS.interview);
            setSeenNpcInterviewed(s => ({ ...s, [obj.speaker]: true }));
          }
        }
      }
    } catch (err) {
      setMsgs(m => [...m, { speaker: 'Navarro', content: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // —— ACCUSATION HANDLERS ——
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

  // —— RENDER PREGAME ——
  if (phase === 'pregame') {
    return (
      <div style={{ padding:16, maxWidth:600, margin:'auto' }}>
        <h1>First 48: The Simulation</h1>
        <p>You have 48 in-game hours to solve the homicide of Mia Rodriguez.</p>
        {hasSave &&
          <button onClick={() => { loadGame(); setPhase('chat'); }}>Load Saved Game</button>
        }
        <div>
          <label>Detective Name:<br/>
            <input value={detectiveName} onChange={e=>setDetectiveName(e.target.value)} />
          </label>
        </div>
        <div>
          <label>Difficulty Mode:<br/>
            <select value={mode} onChange={e=>setMode(e.target.value)}>
              {Object.keys(MODES).map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <p><em>{MODES[mode]}</em></p>
        </div>
        <button disabled={!detectiveName.trim()} onClick={startGame}>
          {hasSave ? 'Load / Continue' : 'Begin New Investigation'}
        </button>
      </div>
    );
  }

  // —— RENDER CHAT PHASE ——
  return (
    <div style={{ padding:16, maxWidth:600, margin:'auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <div><strong>Time:</strong> {fmt(currentClock())} | <strong>Remaining:</strong> {fmt(timeRemaining)}</div>
        <div>
          <button onClick={saveGame}>Save Game</button>
          <button onClick={handleAccuse}>Accuse</button>
        </div>
      </div>

      {/* Message Log */}
      <div style={{ height:'50vh', overflowY:'auto', border:'1px solid #ccc', padding:8, margin:'8px 0' }}>
        {msgs.map((m,i) => (
          <div key={i}><strong>{m.speaker}:</strong> {m.content}</div>
        ))}
        {loading && <div>…thinking…</div>}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <div style={{ display:'flex', gap:8 }}>
        <input
          style={{ flex:1 }}
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&sendMessage()}
          placeholder="Ask Navarro or describe your next move…"
        />
        <button onClick={sendMessage}>Send</button>
        <button onClick={()=>setShowNotepad(true)}>🗒️ Notepad</button>
      </div>

      {/* Notepad Modal */}
      {showNotepad && (
        <div style={{
          position:'fixed', top:80, left:'50%',
          transform:'translateX(-50%)',
          width:'90%', maxWidth:600,
          background:'#fff', border:'1px solid #666', borderRadius:4,
          padding:16, zIndex:1000
        }}>
          <h2>🗒️ Detective’s Notes</h2>
          {notes.length > 0 ? (
            <ul>
              {notes.map((desc,i) => <li key={i}>{desc}</li>)}
            </ul>
          ) : (
            <p>No active leads yet.</p>
          )}
          <p><em>You’re limited to 8 AM–9 PM for interviews.</em></p>
          <button onClick={()=>setShowNotepad(false)}>Close Notepad</button>
        </div>
      )}

      {/* Accusation Modal */}
      {showAccuseModal && (
        <div style={{
          position:'fixed', top:80, left:'50%',
          transform:'translateX(-50%)',
          width:'90%', maxWidth:400,
          background:'#fff', border:'1px solid #666', borderRadius:4,
          padding:16, zIndex:1000
        }}>
          <h2>🔍 Make Your Accusation</h2>
          <select value={selectedSuspect} onChange={e=>setSelectedSuspect(e.target.value)}>
            <option value="" disabled>Select Suspect…</option>
            {caseData.suspects.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={submitAccusation} disabled={!selectedSuspect}>Confirm</button>
        </div>
      )}
    </div>
  );
}
