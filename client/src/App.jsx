import React, { useState, useEffect, useRef } from 'react';

const MODES = {
  Easy: 'Navarro will proactively hint and nudge you along.',
  Classic: 'Navarro only reminds or reframes what’s known when asked.',
  Hard: 'Navarro defers to you—minimal guidance unless explicitly requested.'
};

// Action time costs (minutes)
const ACTION_COSTS = {
  interview: 20,
  forensics: 360,
  recordPull: 15,
  default: 10
};

// Hard-coded action → lead unlocks
const LEAD_UNLOCKS = {
  'bag the bloodstain': ['Send blood sample to lab'],
  'photograph the room': ['Review photos for trace evidence'],
  'interview marvin lott': ['Follow up on neighbor’s timeline'],
  'pull phone records': ['Analyze Mia’s call logs at 3:30 AM']
};

// Helper to format minutes since midnight into HH:MM
function fmt(totalMins) {
  const h = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const m = String(totalMins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export default function App() {
  const START_OF_DAY = 7 * 60 + 50; // 7:50 AM

  const [phase, setPhase] = useState('pregame');
  const [detectiveName, setDetectiveName] = useState('');
  const [mode, setMode] = useState('Classic');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(48 * 60);
  const [location] = useState("Mia's Apartment");
  const [evidence, setEvidence] = useState([]);
  const [leads, setLeads] = useState([]);
  const [interviewCounts, setInterviewCounts] = useState({});
  const [showNotepad, setShowNotepad] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const getCurrentClock = () => START_OF_DAY + timeElapsed;

  const startGame = () => {
    const intro = {
      role: 'assistant',
      content: `*You step under the yellow tape into Mia Rodriguez’s apartment, Detective ${detectiveName}.*  
“Detective ${detectiveName}, Mia was found stabbed this morning—no forced entry, knife still in situ.  
Our neighbor, Marvin Lott, called it in after hearing something around 3:30 AM.  
Up to you where we start.”`
    };
    setMsgs([intro]);
    setPhase('chat');
  };

  const computeCost = text => {
    const t = text.toLowerCase();
    if (t.includes('interview')) return ACTION_COSTS.interview;
    if (t.includes('forensic') || t.includes('dna')) return ACTION_COSTS.forensics;
    if (t.includes('pull') || t.includes('record')) return ACTION_COSTS.recordPull;
    return ACTION_COSTS.default;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const lower = input.toLowerCase();

    // Interview availability
    if (lower.startsWith('interview') && !lower.includes('navarro')) {
      const clock = getCurrentClock();
      const hour = Math.floor(clock / 60);
      if (hour < 8 || hour >= 21) {
        setMsgs(m => [
          ...m,
          {
            role: 'assistant',
            content: `❌ It's ${fmt(clock)}—${hour < 8 ? 'too early' : 'too late'} to interview anyone. Only 8 AM–9 PM.`
          }
        ]);
        setInput('');
        return;
      }
    }

    // Determine base cost
    let cost = computeCost(input);

    // Track interview counts & extra time
    if (lower.startsWith('interview') && !lower.includes('navarro')) {
      const npc = input.slice(9).trim(); // after 'interview '
      setInterviewCounts(prev => {
        const newCount = (prev[npc] || 0) + 1;
        if (newCount > 5) cost += 10; // extra 10 min per extra question
        return { ...prev, [npc]: newCount };
      });
    }

    // Advance time
    const newElapsed = timeElapsed + cost;
    setTimeElapsed(newElapsed);
    setTimeRemaining(prev => prev - cost);

    const userEntry = { role: 'user', content: input };
    const history = [...msgs, userEntry];
    setMsgs(history);
    setInput('');

    const gameState = {
      currentTime: fmt(getCurrentClock()),
      timeRemaining: fmt(timeRemaining - cost),
      location,
      evidence,
      leads,
      mode
    };

    try {
      const res = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, gameState })
      });
      const { text } = await res.json();
      setMsgs(prev => [...prev, { role: 'assistant', content: text }]);

      // unlock new leads based on the action
      const actionKey = input.toLowerCase();
      if (LEAD_UNLOCKS[actionKey]) {
        setLeads(old => {
          const additions = LEAD_UNLOCKS[actionKey].filter(l => !old.includes(l));
          return [...old, ...additions];
        });
      }
    } catch (err) {
      setMsgs(prev => [
        ...prev,
        { role: 'assistant', content: `❌ Error: ${err.message}` }
      ]);
    }
  };

  if (phase === 'pregame') {
    return (
      <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '2rem auto', padding: 16 }}>
        <h1>First 48: The Simulation</h1>
        <p>You have 48 in-game hours to solve the homicide of Mia Rodriguez.</p>
        <p><strong>Tip:</strong> Once the investigation begins, click 🗒️ Notepad to review evidence, leads, and contacts.</p>
        <div style={{ marginTop: 16 }}>
          <label>
            Detective Name:<br />
            <input
              style={{ width: '100%', padding: 8, marginTop: 4 }}
              value={detectiveName}
              onChange={e => setDetectiveName(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <label>
            Difficulty Mode:<br />
            <select
              style={{ width: '100%', padding: 8, marginTop: 4 }}
              value={mode}
              onChange={e => setMode(e.target.value)}
            >
              {Object.keys(MODES).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <p style={{ fontStyle: 'italic', marginTop: 4 }}>{MODES[mode]}</p>
        </div>
        <button
          onClick={startGame}
          disabled={!detectiveName}
          style={{ marginTop: 24, padding: '10px 20px', cursor: detectiveName ? 'pointer' : 'not-allowed' }}
        >
          Begin Investigation
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <h1>First 48 Simulation – Chat with Navarro</h1>
      <div style={{ marginBottom: 8 }}>
        <strong>Detective:</strong> {detectiveName} | <strong>Mode:</strong> {mode}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Location:</strong> {location} | <strong>Time:</strong> {fmt(getCurrentClock())} | <strong>Remaining:</strong> {fmt(timeRemaining)}
      </div>
      <div style={{ height: '50vh', overflowY: 'auto', border: '1px solid #ccc', padding: 12, marginBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            <strong style={{ color: m.role === 'assistant' ? '#fc6' : '#6cf' }}>
              {m.role === 'assistant' ? 'Navarro' : detectiveName}:
            </strong>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask Navarro or describe your next move..."
        />
        <button onClick={sendMessage} style={{ padding: '0 16px' }}>Send</button>
        <button onClick={() => setShowNotepad(true)} style={{ padding: '0 12px' }}>🗒️ Notepad</button>
      </div>

      {showNotepad && (
        <div style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 600,
          background: '#fff',
          color: '#000',
          border: '1px solid #666',
          borderRadius: 4,
          padding: 16,
          zIndex: 1000
        }}>
          <h2>🗒️ Detective’s Notes</h2>
          <section style={{ marginBottom: 16 }}>
            <h3>Initial Suggestions</h3>
            <ul>
              <li>Bag the bloodstain for evidence</li>
              <li>Photograph the room (overhead & detail shots)</li>
              <li>Interview Marvin Lott (neighbor who called it in)</li>
            </ul>
          </section>
          <section style={{ marginBottom: 16 }}>
            <h3>Contacts & Time Costs</h3>
            <ul>
              <li>Tech Forensics (phone data): 24/7, 6 h</li>
              <li>DNA Lab: 24/7, 6 h</li>
              <li>Medical Examiner: 8 AM–6 PM, 30 min</li>
              <li>Crime Scene Unit: 8 AM–5 PM, 60 min</li>
            </ul>
          </section>
          <button
            onClick={() => setShowNotepad(false)}
            style={{
              padding: '6px 12px',
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Close Notepad
          </button>
        </div>
      )}
    </div>
  );
}
