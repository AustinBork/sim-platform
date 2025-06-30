import React, { useState, useEffect, useRef } from 'react';
import { leadDefinitions, applyAction, canAccuse, fmt, evidenceDefinitions } from './gameEngine';
import caseData from '../../server/caseData.json';

const MODES = {
  Easy:    "Navarro will proactively hint and nudge you along.",
  Classic: "Navarro only reminds or reframes what's known when asked.",
  Hard:    "Navarro defers to you—minimal guidance unless explicitly requested.",
};

const ACTION_COSTS = {
  travel:    10,
  interview: 20,
  followUp:  10
};

const INTENT_VERBS = ['knock', 'walk', 'go to', 'head to', 'approach', 'talk to', 'visit', 'ask'];
// Helper function to get commentary for evidence types
function getEvidenceCommentary(evidenceId) {
  switch(evidenceId) {
    case 'stab-wound':
      return "The wound is clean and precise. Looks like a single thrust with a sharp blade. Whoever did this knew exactly where to strike.";
    case 'no-forced-entry':
      return "No signs of breaking and entering. Either the killer had a key, or Mia let them in willingly.";
    case 'partial-cleaning':
      return "Someone tried to clean up after themselves. That suggests premeditation rather than a crime of passion.";
    case 'missing-phone':
      return "Her phone is missing. Could be the killer took it to hide evidence of their communications.";
    case 'locked-door':
      return "Door was locked from inside. That's strange considering there was no forced entry. The killer must have left another way.";
    case 'bloodstain':
      return "That blood spatter doesn't match a typical stabbing. The angle is off. Something's not adding up here.";
    case 'bracelet-charm':
      return "A small charm from a bracelet. Could have broken off during a struggle. We should check if it belongs to anyone who knew Mia.";
    default:
      return null;
  }
}
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
  // new state for lead triggers
  const [actionsPerformed, setActionsPerformed]     = useState([]);
  const [interviewsCompleted, setInterviewsCompleted] = useState([]);
  const [showNotepad, setShowNotepad]         = useState(false);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState('');
  const [hasSave, setHasSave]                 = useState(false);
  const [savedState, setSavedState]           = useState(null);
  const scrollRef                             = useRef(null);

  // —— DERIVED NOTES STATE ——
  const [notes, setNotes] = useState([]);
  useEffect(() => {
    console.log('🔍 Updating notes from leads:', leads);
    const unlocked = leadDefinitions
      .filter(d => leads.includes(d.id) && !d.isRedHerring)
      .map(d => d.description);
    console.log('📝 Setting notes to:', unlocked);
    setNotes(unlocked || []);
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
      seenNpcInterviewed,
      actionsPerformed,
      interviewsCompleted
    };
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
    setActionsPerformed(savedState.actionsPerformed || []);
    setInterviewsCompleted(savedState.interviewsCompleted || []);
  };

  // —— START NEW INVESTIGATION ——
  const startGame = () => {
    if (!detectiveName.trim()) return;
    const intro = `*You step under the yellow tape into Mia Rodriguez's apartment, Detective ${detectiveName}.*  
"Detective ${detectiveName}, Mia was found stabbed this morning—no forced entry, knife still in situ.  
Our neighbor, Marvin Lott, called it in after hearing something around 3:30 AM.  
Up to you where we start."`;
    setMsgs([{ speaker: 'System', content: intro }]);
    setPhase('chat');
    setTimeElapsed(0);
    setTimeRemaining(48 * 60);
    setEvidence([]);
    setLeads([]);
    setInterviewCounts({});
    setSeenNpcInterviewed({});
    setActionsPerformed([]);
    setInterviewsCompleted([]);
  };

// —— SEND ACTION / MESSAGE ——
const sendMessage = async () => {
  const actionText = input.trim();
  console.log('✅ App.sendMessage: about to call applyAction with:', actionText);
  if (!actionText) return;
  setInput('');

  // call gameEngine with full state
  const result = applyAction({
    timeElapsed,
    timeRemaining,
    evidence,
    leads,
    interviewCounts,
    actionsPerformed,
    interviewsCompleted
  }, actionText);

  if (result.error) {
    setMsgs(m => [...m, { speaker: 'System', content: `❌ ${result.error}` }]);
    return;
  }

  const { newState, cost, newLeads, discoveredEvidence } = result;
  console.log('🔍 [DEBUG] leads after applyAction:', newState.leads);
  console.log('🔍 [DEBUG] evidence discovered:', discoveredEvidence);
  setTimeElapsed(newState.timeElapsed);
  setTimeRemaining(newState.timeRemaining);
  setEvidence(newState.evidence);
  setLeads(newState.leads);
  setInterviewCounts(newState.interviewCounts);
  setActionsPerformed(newState.actionsPerformed);
  setInterviewsCompleted(newState.interviewsCompleted);

  setMsgs(m => [...m, { speaker: detectiveName, content: actionText }]);
  
  // Add notifications for any new leads
  if (newLeads && newLeads.length > 0) {
    for (const lead of newLeads) {
      setMsgs(m => [
        ...m, 
        { 
          speaker: 'System', 
          content: `🕵️ New lead unlocked: ${lead.description}`
        }
      ]);
      
      // If the lead has a narrative, add that as a follow-up from Navarro
      if (lead.narrative) {
        setMsgs(m => [
          ...m,
          {
            speaker: 'Navarro',
            content: lead.narrative
          }
        ]);
      }
    }
  }
  // Handle any newly discovered evidence
if (discoveredEvidence && discoveredEvidence.length > 0) {
  for (const evidenceId of discoveredEvidence) {
    // Find the evidence definition
    const evidenceDef = evidenceDefinitions.find(e => e.id === evidenceId);
    if (evidenceDef) {
      // Add system message announcing the discovery
      setMsgs(m => [
        ...m, 
        { 
          speaker: 'System', 
          content: `🔍 Evidence discovered: ${evidenceDef.description}`
        }
      ]);
      
      // Add Navarro's commentary about the evidence
      const commentary = getEvidenceCommentary(evidenceId);
      if (commentary) {
        setMsgs(m => [
          ...m,
          {
            speaker: 'Navarro',
            content: commentary
          }
        ]);
      }
    }
  }
}
  setLoading(true);

  // —— PROXY CALL ——
  try {
    const history = [...msgs, { speaker: detectiveName, content: actionText }].map(m => ({
      role: m.speaker === 'System' ? 'system'
           : m.speaker === detectiveName ? 'user'
           : 'assistant',
      content: m.content
    }));
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
  evidence: newState.evidence,
  leads: newState.leads,
  detectiveName,
}
      }),
    });
    const { text } = await res.json();

    // —— DEBUG LOGS ——
    const lines = text.trim().split(/\r?\n/);
    const parsed = lines
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(o => o && (o.type === 'stage' || o.type === 'dialogue'));

    console.log('💬 RAW STREAM LINES:', lines);
    console.log('💬 PARSED OBJECTS:', parsed);

    for (const obj of parsed) {
      console.log('🔸 obj:', obj);
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

      // Enhanced Notepad Component for App.jsx
// This replaces the existing notepad modal with a more organized structure

{/* Notepad Modal */}
{showNotepad && (
  <div style={{
    position:'fixed', top:80, left:'50%',
    transform:'translateX(-50%)',
    width:'90%', maxWidth:700,
    background:'#fff', border:'1px solid #666', borderRadius:4,
    padding:20, zIndex:1000,
    color: '#000',
    maxHeight: '80vh',
    overflowY: 'auto'
  }}>
    <h2 style={{ color: '#000', marginBottom: '16px', borderBottom: '2px solid #333', paddingBottom: '8px' }}>
      🗒️ Detective's Notepad
    </h2>
    
    {/* Detective's Thoughts Section */}
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#000', marginBottom: '8px', fontSize: '1.2rem' }}>Detective's Thoughts</h3>
      <ul style={{ color: '#444', paddingLeft: '20px', marginTop: '8px' }}>
        <li style={{ marginBottom: '8px' }}>
          I should thoroughly photograph and document this crime scene. The layout and positioning of items may reveal important clues.
        </li>
        <li style={{ marginBottom: '8px' }}>
          The neighbor, Marvin Lott, called it in after hearing something around 3:30 AM. I should speak with him.
        </li>
        {timeElapsed > 30 && (
          <li style={{ marginBottom: '8px' }}>
            I should check if there's any security footage or cameras in the building.
          </li>
        )}
        {leads.includes('victim-background') && (
          <li style={{ marginBottom: '8px' }}>
            Learning more about Mia's relationships and recent activities could point to suspects.
          </li>
        )}
      </ul>
    </div>
    
    {/* Evidence Section */}
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#000', marginBottom: '8px', fontSize: '1.2rem' }}>Evidence Collected</h3>
      
      {leads.includes('scene-photos') ? (
        <div>
          <h4 style={{ color: '#000', marginBottom: '4px', fontSize: '1.1rem' }}>Crime Scene Observations:</h4>
          <ul style={{ color: '#444', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '4px' }}>Single stab wound to victim's abdomen</li>
            <li style={{ marginBottom: '4px' }}>No signs of forced entry on door or windows</li>
            <li style={{ marginBottom: '4px' }}>Apartment appears partially cleaned</li>
            <li style={{ marginBottom: '4px' }}>Victim's phone is missing from the scene</li>
            <li style={{ marginBottom: '4px' }}>Door was locked from inside</li>
          </ul>
        </div>
      ) : evidence.length > 0 ? (
        <ul style={{ color: '#444', paddingLeft: '20px' }}>
          {evidence.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No physical evidence collected yet. Try examining the crime scene more thoroughly.</p>
      )}
    </div>
    
    {/* Suspects Section */}
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#000', marginBottom: '8px', fontSize: '1.2rem' }}>Possible Suspects</h3>
      
      {interviewsCompleted.length > 0 ? (
        <div>
          {interviewsCompleted.includes('Marvin Lott') && (
            <div style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h4 style={{ color: '#000', margin: '0 0 4px 0', fontSize: '1.1rem' }}>Marvin Lott (Neighbor)</h4>
              <ul style={{ color: '#444', paddingLeft: '20px', margin: '4px 0' }}>
                <li>Called police after hearing scream around 3:30 AM</li>
                <li>Appeared nervous during questioning</li>
                {leads.includes('interview-marvin') && (
                  <>
                    <li>Claims to have heard furniture moving after the scream</li>
                    <li>Mentioned seeing someone leave the building around 3:45-4:00 AM</li>
                  </>
                )}
              </ul>
            </div>
          )}
          
          {interviewsCompleted.includes('Rachel Kim') && (
            <div style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h4 style={{ color: '#000', margin: '0 0 4px 0', fontSize: '1.1rem' }}>Rachel Kim (Best Friend)</h4>
              <ul style={{ color: '#444', paddingLeft: '20px', margin: '4px 0' }}>
                <li>Claims to have found the body at 8:00 AM</li>
                <li>Was supposed to meet Mia for breakfast</li>
                <li>Suggests looking into ex-boyfriend Jordan</li>
                {leads.includes('phone-records') && (
                  <li style={{ color: '#a00' }}>Phone records show call to Mia at 7:25 AM (inconsistency)</li>
                )}
              </ul>
            </div>
          )}
          
          {interviewsCompleted.includes('Jordan Valez') && (
            <div style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h4 style={{ color: '#000', margin: '0 0 4px 0', fontSize: '1.1rem' }}>Jordan Valez (Ex-Boyfriend)</h4>
              <ul style={{ color: '#444', paddingLeft: '20px', margin: '4px 0' }}>
                <li>Claims to have been at The Lockwood Bar until midnight</li>
                <li>Has history of issues with the victim</li>
                <li>Says he and Mia recently started talking again</li>
                {leads.includes('phone-records') && (
                  <li>Has verifiable Uber receipt from 12:05 AM</li>
                )}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No suspects interviewed yet.</p>
      )}
    </div>
    
    {/* Timeline Section */}
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#000', marginBottom: '8px', fontSize: '1.2rem' }}>Case Timeline</h3>
      <ul style={{ color: '#444', paddingLeft: '20px' }}>
        <li style={{ marginBottom: '4px' }}><strong>7:45 AM</strong> - Body discovered</li>
        <li style={{ marginBottom: '4px' }}><strong>3:30 AM</strong> - Marvin Lott heard scream</li>
        {leads.includes('interview-marvin') && (
          <li style={{ marginBottom: '4px' }}><strong>~3:45 AM</strong> - Marvin potentially saw someone leaving building</li>
        )}
        {leads.includes('phone-records') && (
          <li style={{ marginBottom: '4px' }}><strong>7:25 AM</strong> - Rachel called Mia's phone (before claimed discovery)</li>
        )}
        <li style={{ marginBottom: '4px' }}><strong>2:00-4:00 AM</strong> - Estimated time of death</li>
      </ul>
    </div>
    
    {/* Active Leads Section */}
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#000', marginBottom: '8px', fontSize: '1.2rem' }}>Active Leads</h3>
      {notes && notes.length > 0 ? (
        <ul style={{ color: '#444', paddingLeft: '20px' }}>
          {notes.map((desc, i) => {
            // Find the full lead definition for this description
            const leadDef = leadDefinitions.find(d => d.description === desc);
            return (
              <li key={i} style={{ 
                color: '#000', 
                marginBottom: '12px',
                fontWeight: leadDef?.isRedHerring ? 'normal' : 'bold'
              }}>
                {desc}
                {leadDef?.narrative && (
                  <div style={{ 
                    color: '#555', 
                    fontStyle: 'italic',
                    fontWeight: 'normal',
                    fontSize: '0.9em',
                    marginTop: '4px'
                  }}>
                    Note: {leadDef.narrative}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No active leads yet. Try investigating the crime scene or interviewing witnesses.</p>
      )}
    </div>
    
    {/* Interview Hours Reminder */}
    <p style={{ 
      color: '#000', 
      borderTop: '1px solid #ccc', 
      paddingTop: '10px', 
      marginTop: '16px',
      fontSize: '0.9em' 
    }}>
      <em>⏰ Interview hours: 8 AM–9 PM</em>
    </p>
    
    <button 
      onClick={()=>setShowNotepad(false)}
      style={{
        padding: '8px 16px',
        background: '#333',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginTop: '10px'
      }}
    >
      Close Notepad
    </button>
  </div>
)}
      {/* Accusation Modal */}
      {showAccuseModal && (
        <div style={{
          position:'fixed', top:80, left:'50%',
          transform:'translateX(-50%)',
          width:'90%', maxWidth:400,
          background:'#fff', border:'1px solid #666', borderRadius:4,
          padding:16, zIndex:1000,
          color: '#000'
        }}>
          <h2 style={{ color: '#000' }}>🔍 Make Your Accusation</h2>
          <select 
            value={selectedSuspect} 
            onChange={e=>setSelectedSuspect(e.target.value)}
            style={{ color: '#000' }}
          >
            <option value="" disabled>Select Suspect…</option>
            {caseData.suspects.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <button 
            onClick={submitAccusation} 
            disabled={!selectedSuspect}
            style={{
              padding: '8px 16px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}