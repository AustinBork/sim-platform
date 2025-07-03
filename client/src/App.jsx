import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [phase, setPhase]                     = useState('intro');
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
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [conversationState, setConversationState] = useState({
    currentCharacter: null,
    characters: {},
    pendingAction: null,
    conversationPhase: 'NONE', // 'GREETING', 'QUESTIONING', 'CONCLUDING'
    lastResponseTime: null
  });
  // new state for lead triggers
  const [actionsPerformed, setActionsPerformed]     = useState([]);
  const [interviewsCompleted, setInterviewsCompleted] = useState([]);
  const [showNotepad, setShowNotepad]         = useState(false);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState('');
  const [hasSave, setHasSave]                 = useState(false);
  const [savedState, setSavedState]           = useState(null);
  const scrollRef                             = useRef(null);
  const [notepadUpdated, setNotepadUpdated] = useState(false);
  const [lastLeadAdded, setLastLeadAdded] = useState(null);
  const [lastEvidenceAdded, setLastEvidenceAdded] = useState(null);
  const [notificationTimeout, setNotificationTimeout] = useState(null);
  const [detectiveThoughts, setDetectiveThoughts] = useState([
    "I should thoroughly examine the crime scene for evidence.",
    "Marvin Lott, the neighbor who called it in, might have important information.",
    "Need to establish a timeline of events leading to the murder."
  ]);

// Enhanced conversation ending detection
const isEndingConversation = useCallback((text, currentState) => {
  // If we're not in a conversation, we can't end one
  if (!currentState.currentCharacter) return false;

  const lowerText = text.toLowerCase();
  
  // Expanded list of goodbye phrases
  const goodbyePhrases = [
    'goodbye', 'bye', 'see you', 'thanks', 'thank you',
    'that will be all', 'that is all', 'that\'s all',
    'if we need', 'we will find you', 'find you later',
    'contact you', 'that helps', 'let\'s go', 'let\'s leave',
    'i should go', 'need to go', 'moving on', 'leave now',
    'go back', 'return to', 'head back', 'enough for now'
  ];
  
  // Movement phrases that indicate leaving
  const movementPhrases = [
    'go back to', 'return to', 'leave', 'exit', 'head to',
    'go to the', 'check out', 'investigate', 'examine'
  ];
  
  // Check for explicit goodbyes
  const isGoodbye = goodbyePhrases.some(phrase => lowerText.includes(phrase));
  
  // Check for movement away from the conversation
  const isMovingAway = currentState.currentCharacter && 
                      movementPhrases.some(phrase => lowerText.includes(phrase)) &&
                      !lowerText.includes(currentState.currentCharacter.toLowerCase());
  
  const isEnding = isGoodbye || isMovingAway;
  
  console.log('🔍 Checking if ending conversation:', isEnding);
  
  return isEnding;
}, []);

  // —— DERIVED NOTES STATE ——
  // Function to update detective thoughts based on game state
  const updateDetectiveThoughts = () => {
    // Start with default thoughts
    const defaultThoughts = [];
    
    // Add context-specific thoughts
    if (!leads.includes('scene-photos')) {
      defaultThoughts.push("I should photograph the crime scene to document evidence.");
    }
    
    if (!interviewsCompleted.includes('Marvin Lott')) {
      defaultThoughts.push("I should speak with Marvin Lott, the neighbor who reported the crime.");
    }
    
    if (leads.includes('victim-background') && !actionsPerformed.some(a => a.includes('background'))) {
      defaultThoughts.push("I need to research Mia's background and relationships.");
    }
    
    if (leads.includes('blood-analysis') && !actionsPerformed.some(a => a.includes('blood'))) {
      defaultThoughts.push("The blood spatter pattern looks unusual. Should have the lab analyze it.");
    }
    
    if (leads.includes('knife-analysis') && !actionsPerformed.some(a => a.includes('knife'))) {
      defaultThoughts.push("The murder weapon could hold important clues. Should have forensics analyze it.");
    }
    
    if (interviewsCompleted.length > 0 && !leads.includes('phone-records')) {
      defaultThoughts.push("Phone records might reveal important connections between suspects.");
    }
    
    if (leads.length > 3 && timeElapsed > 60) {
      defaultThoughts.push("I should review what I know so far and look for connections.");
    }
    
    setDetectiveThoughts(defaultThoughts);
  };

  // Update detective thoughts when relevant state changes
  useEffect(() => {
    updateDetectiveThoughts();
  }, [leads, interviewsCompleted, actionsPerformed, timeElapsed]);
  
  // Function to show notepad notification
  const showNotepadNotification = (type, item) => {
    // Clear any existing timeout
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }
    
    if (type === 'lead') {
      setLastLeadAdded(item);
    } else if (type === 'evidence') {
      setLastEvidenceAdded(item);
    }
    
    setNotepadUpdated(true);
    
    // Hide notification after 5 seconds
    const timeout = setTimeout(() => {
      setNotepadUpdated(false);
      setLastLeadAdded(null);
      setLastEvidenceAdded(null);
    }, 5000);
    
    setNotificationTimeout(timeout);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
    };
  }, [notificationTimeout]);
  
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

  // Helper function to detect character mentions in user input
// Enhanced character mention detection
function detectCharacterMention(text, currentState) {
  const lowerText = text.toLowerCase();
  console.log('🔍 Detecting character in:', lowerText);

  // Create a more comprehensive detection system with character aliases
  const characterAliases = {
    'Marvin Lott': ['marvin', 'neighbor', 'neighbour', 'lott', 'the neighbor', 'next door'],
    'Rachel Kim': ['rachel', 'kim', 'best friend', 'friend', 'mia\'s friend'],
    'Jordan Valez': ['jordan', 'valez', 'ex', 'boyfriend', 'ex-boyfriend', 'ex boyfriend']
  };
  
  // Check for exact character names first
  for (const [character, aliases] of Object.entries(characterAliases)) {
    // Direct reference to character
    if (aliases.some(alias => lowerText.includes(alias))) {
      console.log(`✅ Detected ${character} through alias`);
      return character;
    }
  }
  
  // Action-based references (more contextual)
  const actionPhrases = ['talk to', 'speak with', 'interview', 'ask', 'go to', 'visit', 'meet', 'find'];
  
  for (const [character, aliases] of Object.entries(characterAliases)) {
    for (const phrase of actionPhrases) {
      for (const alias of aliases) {
        if (lowerText.includes(`${phrase} ${alias}`)) {
          console.log(`✅ Detected intent to speak with ${character}`);
          return character;
        }
      }
    }
  }
  
  // Location-based references
  if (lowerText.includes("neighbor's door") || lowerText.includes("next door")) {
    console.log('✅ Detected Marvin Lott through location');
    return 'Marvin Lott';
  }
  
  // If already in conversation with a character and not ending it
  if (currentState.currentCharacter && 
      currentState.conversationPhase !== 'CONCLUDING' &&
      !isEndingConversation(text, currentState)) {
    console.log('✅ Continuing conversation with', currentState.currentCharacter);
    return currentState.currentCharacter;
  }
  
  console.log('❌ No character detected');
  return null;
}

  // Helper function to extract potential topics from dialogue
  function extractTopics(text) {
    const topics = [];
    const lowerText = text.toLowerCase();
    
    // Check for common topics in the dialogue
    if (lowerText.includes('scream') || lowerText.includes('heard')) {
      topics.push('noise');
    }
    
    if (lowerText.includes('time') || lowerText.includes('clock') || lowerText.includes('when')) {
      topics.push('timing');
    }
    
    if (lowerText.includes('mia') || lowerText.includes('victim') || lowerText.includes('rodriguez')) {
      topics.push('victim');
    }
    
    if (lowerText.includes('relationship') || lowerText.includes('friend') || lowerText.includes('knew')) {
      topics.push('relationships');
    }
    
    if (lowerText.includes('see') || lowerText.includes('saw') || lowerText.includes('witness')) {
      topics.push('witness');
    }
    
    if (lowerText.includes('door') || lowerText.includes('window') || lowerText.includes('entry')) {
      topics.push('entry');
    }
    
    if (lowerText.includes('knife') || lowerText.includes('weapon') || lowerText.includes('stab')) {
      topics.push('weapon');
    }
    
    return topics;
  }

function isGeneralInvestigativeAction(text) {
  const lowerText = text.toLowerCase();
  const actionKeywords = [
    'photograph', 'photo', 'picture', 'take pic', 
    'examine', 'check', 'look at', 'search', 'investigate',
    'analyze', 'test', 'document', 'collect', 'gather',
    'forensic', 'lab', 'send to', 'process'
  ];
  
  return actionKeywords.some(keyword => lowerText.includes(keyword));
}

  // Helper function to get a contextual Navarro affirmation
  function getNavarroAffirmation(actionText) {
    // List of affirmative responses for Navarro
    const navarroAffirmations = [
      "Good thinking, Detective.",
      "That's a solid approach.",
      "I was thinking the same thing.",
      "Let's do it.",
      "Worth checking out.",
      "Good call.",
      "That could give us some useful information.",
      "I'm with you on that.",
      "Makes sense to me.",
      "That's our best move right now."
    ];

    // Context-aware affirmations
    const contextAffirmations = {
      'photograph': [
        "Getting photos will help us document everything properly.",
        "We should capture as much detail as possible.",
        "Good idea to document the scene before anything changes."
      ],
      'interview': [
        "They might have valuable information for us.",
        "I'm curious what they have to say.",
        "Witness statements are critical at this stage."
      ],
      'evidence': [
        "That evidence could be key to solving this.",
        "Let's make sure we don't miss anything important.",
        "The details will matter for building our case."
      ],
      'suspect': [
        "We should keep a close eye on them.",
        "Their story needs to be verified.",
        "Let's see if their alibi holds up."
      ]
    };

    const lowerAction = actionText.toLowerCase();
    
    // Check for context matches
    for (const [context, responses] of Object.entries(contextAffirmations)) {
      if (lowerAction.includes(context)) {
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
    
    // Default to general affirmation if no context match
    return navarroAffirmations[Math.floor(Math.random() * navarroAffirmations.length)];
  }

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
      interviewsCompleted,
      conversationState
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
    setConversationState(savedState.conversationState || {
      currentCharacter: null,
      characters: {},
      pendingAction: null,
      conversationPhase: 'NONE',
      lastResponseTime: null
    });
  };

  // Update the startGame function
  const startGame = () => {
    if (!detectiveName.trim()) return;
    
    // Set scene with system message
    const systemIntro = `*You step under the yellow tape into Mia Rodriguez's apartment. The early morning light filters through half-drawn blinds, casting the room in a pale glow. The air is heavy with the metallic scent of blood.*`;
    
    // Navarro provides the case briefing
    const navarroIntro = `Morning, ${detectiveName}. It's a bad one. Victim is Mia Rodriguez, 26 years old. Found stabbed this morning. No sign of forced entry, and the murder weapon was left at the scene. Neighbor, Marvin Lott, called it in after hearing a scream around 3:30 AM. Where do you want to start?`;
    
    setMsgs([
      { speaker: 'System', content: systemIntro },
      { speaker: 'Navarro', content: navarroIntro }
    ]);
    
    setPhase('chat');
    setTimeElapsed(0);
    setTimeRemaining(48 * 60);
    setEvidence([]);
    setLeads([]);
    setInterviewCounts({});
    setSeenNpcInterviewed({});
    setActionsPerformed([]);
    setInterviewsCompleted([]);
    setConversationState({
      currentCharacter: null,
      characters: {},
      pendingAction: null,
      conversationPhase: 'NONE',
      lastResponseTime: null
    });
  };

  // Process pending notifications after character dialogue
  const processPendingNotifications = () => {
    if (pendingNotifications.length === 0) return;
    console.log('📣 Processing pending notifications:', pendingNotifications);
    
    // Process each pending notification
    pendingNotifications.forEach(notification => {
      if (notification.type === 'lead') {
        const leadItem = notification.item;
        // Show lead notification in chat
        setMsgs(m => [
          ...m, 
          { 
            speaker: 'System', 
            content: `🕵️ New lead unlocked: ${leadItem.description}`
          }
        ]);
        
        // Show notepad notification
        showNotepadNotification('lead', leadItem);
        
        // If the lead has a narrative, add that as a follow-up from Navarro
        if (leadItem.narrative) {
          setMsgs(m => [
            ...m,
            {
              speaker: 'Navarro',
              content: leadItem.narrative
            }
          ]);
        }
      } else if (notification.type === 'evidence') {
        // Show evidence notification in chat
        const evidenceDef = notification.item;
        setMsgs(m => [
          ...m, 
          { 
            speaker: 'System', 
            content: `🔍 Evidence discovered: ${evidenceDef.description}`
          }
        ]);
        
        // Show notepad notification
        showNotepadNotification('evidence', evidenceDef);
        
        // Add Navarro's commentary about the evidence
        const commentary = getEvidenceCommentary(evidenceDef.id);
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
    });
    
    // Clear pending notifications
    setPendingNotifications([]);
  };

    // —— PROXY CALL ——
// Replace the existing sendMessage function with this implementation

const sendMessage = async () => {
  if (!input.trim()) return;
  
  setMsgs(m => [...m, { speaker: detectiveName, content: input }]);
  setLoading(true);
  
  // Extract current character and state from conversationState
  const currentCharacter = conversationState.currentCharacter;
  const pendingAction = conversationState.pendingAction;
  
  // Check if the message is ending a conversation
  const isEnding = isEndingConversation(input, conversationState);
  
  // Check if starting a new conversation with a character
  const mentionedCharacter = detectCharacterMention(input, conversationState);
  
  // Update conversation state before sending request
  if (mentionedCharacter && mentionedCharacter !== currentCharacter) {
    // Starting conversation with new character
    setConversationState(prev => ({
      ...prev,
      currentCharacter: mentionedCharacter,
      pendingAction: 'MOVE_TO_CHARACTER',
      conversationPhase: 'GREETING',
      characters: {
        ...prev.characters,
        [mentionedCharacter]: {
          ...(prev.characters[mentionedCharacter] || {}),
          state: prev.characters[mentionedCharacter]?.state === 'INITIAL' ? 'RETURNING' : 'INITIAL'
        }
      }
    }));
  } else if (currentCharacter && !isEnding) {
    // Continuing conversation with current character
    setConversationState(prev => ({
      ...prev,
      pendingAction: 'CONTINUE_CONVERSATION',
      conversationPhase: 'QUESTIONING'
    }));
  } else if (currentCharacter && isEnding) {
    // Ending conversation
    setConversationState(prev => ({
      ...prev,
      pendingAction: 'END_CONVERSATION',
      conversationPhase: 'CONCLUDING'
    }));
  } else if (input.toLowerCase().includes('navarro') || 
             input.toLowerCase().includes('partner') || 
             input.toLowerCase().includes('what do you think')) {
    // Asking Navarro directly
    setConversationState(prev => ({
      ...prev,
      pendingAction: 'ASK_NAVARRO',
      conversationPhase: 'NONE'
    }));
  }
  
  // Clear input field
  setInput('');
  
  const actionText = input;
  
  // This code replaces the try/catch block in the sendMessage function

try {
  const conversationContext = currentCharacter
  ? {
      character: currentCharacter,
      state: conversationState.characters[currentCharacter]?.state || 'INITIAL',
      topicsDiscussed: conversationState.characters[currentCharacter]?.topicsDiscussed || []
    }
  : null;

  console.log('📤 Sending to proxy with calculated values:', {
    currentCharacter: mentionedCharacter || currentCharacter,
    pendingAction: conversationState.pendingAction
  });

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
        evidence: evidence,
        leads: leads,
        detectiveName,
        conversation: conversationContext,
        pendingAction: conversationState.pendingAction,
        currentCharacter: mentionedCharacter || currentCharacter
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

  // Process responses in the correct order
  const stageDirections = parsed.filter(obj => obj.type === 'stage');
  const dialogueResponses = parsed.filter(obj => obj.type === 'dialogue');
  
  // First add stage directions
  for (const obj of stageDirections) {
    setMsgs(m => [...m, { speaker: 'System', content: `*${obj.description}*` }]);
  }
  
  // Then add dialogue responses
  for (const obj of dialogueResponses) {
    // Validate the speaker matches our expected conversation partner
    let speaker = obj.speaker;
    
    // Enforce conversation state - if we're in a conversation with a character
    // and we get dialogue that's not from that character or Navarro, fix it
    if (
      conversationState.currentCharacter && 
      speaker !== conversationState.currentCharacter && 
      speaker !== 'Navarro' && 
      conversationState.pendingAction !== 'ASK_NAVARRO'
    ) {
      console.warn(`⚠️ Speaker mismatch! Expected ${conversationState.currentCharacter}, got ${speaker}. Fixing.`);
      speaker = conversationState.currentCharacter;
    }
    
    // If we're asking Navarro specifically, enforce that the response is from him
    if (conversationState.pendingAction === 'ASK_NAVARRO' && speaker !== 'Navarro') {
      console.warn(`⚠️ Speaker mismatch! Expected Navarro for ASK_NAVARRO action, got ${speaker}. Fixing.`);
      speaker = 'Navarro';
    }
    
    // Add the message with validated speaker
    setMsgs(m => [...m, { speaker: speaker, content: obj.text }]);
    
    // Update conversation topics if this is character dialogue
    if (speaker !== 'Navarro' && speaker === conversationState.currentCharacter) {
      // Extract potential topics from the dialogue
      const topics = extractTopics(obj.text);
      
      setConversationState(prev => ({
        ...prev,
        characters: {
          ...prev.characters,
          [speaker]: {
            ...prev.characters[speaker],
            topicsDiscussed: [...(prev.characters[speaker]?.topicsDiscussed || []), ...topics]
          }
        }
      }));
    }
    
    // Handle interview time costs
    if (speaker !== 'Navarro' && !seenNpcInterviewed[speaker]) {
      setTimeElapsed(te => te + ACTION_COSTS.interview);
      setTimeRemaining(tr => tr - ACTION_COSTS.interview);
      setSeenNpcInterviewed(s => ({ ...s, [speaker]: true }));
    }
  }
  
  // If no valid response was parsed, add a fallback
  if (parsed.length === 0) {
    console.warn('⚠️ No valid response parsed! Adding fallback message.');
    
    // Determine who should be speaking
    const fallbackSpeaker = conversationState.pendingAction === 'ASK_NAVARRO' 
      ? 'Navarro' 
      : conversationState.currentCharacter || 'Navarro';
    
    // Add a fallback message
    setMsgs(m => [...m, { 
      speaker: fallbackSpeaker, 
      content: fallbackSpeaker === 'Navarro'
        ? "Let's stay focused on the investigation, Detective."
        : "I'm not sure I understand. Could you rephrase that?"
    }]);
  }
  
  // After all character dialogue is processed, then show the notifications
  setTimeout(() => {
    processPendingNotifications();
  }, 500); // Short delay to ensure dialogue is processed first
  
  // Reset conversation state if character is exiting the conversation
  if (conversationState.conversationPhase === 'CONCLUDING') {
    setTimeout(() => {
      setConversationState(prev => ({
        ...prev,
        currentCharacter: null,
        pendingAction: null,
        conversationPhase: 'NONE'
      }));
    }, 1000); // Small delay to let the goodbye message process
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

  // Game explanation screen (intro phase)
  if (phase === 'intro') {
    return (
      <div style={{ 
        padding: 24, 
        maxWidth: 650, 
        margin: 'auto',
        backgroundColor: '#1e1e1e',
        color: '#e0e0e0',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <h1 style={{ color: '#e63946', marginBottom: 24 }}>First 48: Homicide Investigation</h1>
        
        <div style={{ marginBottom: 24 }}>
          <p>You are a detective with only 48 hours to solve the murder of Mia Rodriguez.</p>
          <p>Your choices, the evidence you discover, and how you interact with suspects will determine whether you crack the case in time.</p>
        </div>
        
        <div style={{ 
          border: '1px solid #444', 
          padding: 16, 
          borderRadius: 4, 
          marginBottom: 24,
          backgroundColor: '#2a2a2a'
        }}>
          <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 8, marginBottom: 16 }}>Game Features</h3>
          <ul style={{ paddingLeft: 24 }}>
            <li style={{ marginBottom: 8 }}><strong>Detective's Notepad</strong>: Access your notes, evidence, suspects, and leads by clicking the notepad button.</li>
            <li style={{ marginBottom: 8 }}><strong>Partner Assistance</strong>: Your partner, Detective Navarro, can provide insights. Don't hesitate to ask for his thoughts.</li>
            <li style={{ marginBottom: 8 }}><strong>Time Management</strong>: Each action consumes time. You have 48 hours to solve the case.</li>
            <li style={{ marginBottom: 8 }}><strong>Dialogue System</strong>: How you speak to witnesses and suspects affects how much they reveal.</li>
          </ul>
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <h3>Difficulty Modes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div style={{ 
              padding: 12, 
              backgroundColor: '#2a4365', 
              borderRadius: 4,
              opacity: mode === 'Easy' ? 1 : 0.7,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }} onClick={() => setMode('Easy')}>
              <strong>Easy</strong>: Navarro will proactively hint and nudge you along.
            </div>
            <div style={{ 
              padding: 12, 
              backgroundColor: '#2a4d4e', 
              borderRadius: 4,
              opacity: mode === 'Classic' ? 1 : 0.7,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }} onClick={() => setMode('Classic')}>
              <strong>Classic</strong>: Navarro only reminds or reframes what's known when asked.
            </div>
            <div style={{ 
              padding: 12, 
              backgroundColor: '#4d2a2a', 
              borderRadius: 4,
              opacity: mode === 'Hard' ? 1 : 0.7,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }} onClick={() => setMode('Hard')}>
              <strong>Hard</strong>: Navarro defers to you—minimal guidance unless explicitly requested.
            </div>
          </div>
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Your Detective's Name:
            <input 
              value={detectiveName} 
              onChange={e => setDetectiveName(e.target.value)} 
              style={{ 
                display: 'block', 
                width: '100%', 
                padding: '8px 12px', 
                marginTop: 8,
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4
              }} 
              placeholder="Enter your detective's name"
            />
          </label>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {hasSave && (
            <button 
              onClick={() => { loadGame(); setPhase('chat'); }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Load Saved Game
            </button>
          )}
          <button 
            disabled={!detectiveName.trim()} 
            onClick={() => setPhase('pregame')}
            style={{
              padding: '10px 20px',
              backgroundColor: detectiveName.trim() ? '#e63946' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: detectiveName.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Begin Investigation
          </button>
        </div>
      </div>
    );
  }

  // Pre-game cinematic (pregame phase)
  if (phase === 'pregame') {
    return (
      <div style={{ 
        padding: 24, 
        maxWidth: 650, 
        margin: 'auto',
        backgroundColor: '#1e1e1e',
        color: '#e0e0e0',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 24 }}>
            <em>Early morning mist clings to the asphalt as you pull up to the apartment complex. Red and blue lights flash silently against the brick facade. The sun is just beginning to rise, casting long shadows across the crime scene.</em>
          </p>
          
          <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 24 }}>
            <em>You spot Detective Navarro waiting by the police line, nursing a cup of coffee. His weathered face shows the strain of too many crime scenes. He nods as you approach.</em>
          </p>
          
          <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 24 }}>
            <em>"Morning, Detective {detectiveName}," he says grimly. "Ready for this?"</em>
          </p>
        </div>
        
        <button 
          onClick={startGame}
          style={{
            padding: '12px 24px',
            backgroundColor: '#e63946',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 16,
            cursor: 'pointer',
            alignSelf: 'flex-end'
          }}
        >
          Begin Investigation
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
        {notepadUpdated && (
          <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: 16,
            borderRadius: 8,
            maxWidth: 300,
            zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            border: '1px solid #444'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 24, marginRight: 8 }}>📝</span>
              <span style={{ fontWeight: 'bold' }}>Notepad Updated</span>
            </div>
            
            {lastLeadAdded && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#ffd700' }}>New Lead:</span> {lastLeadAdded.description}
              </div>
            )}
            
            {lastEvidenceAdded && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#4caf50' }}>New Evidence:</span> {lastEvidenceAdded.description}
              </div>
            )}
            
            <button 
              onClick={() => setShowNotepad(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#333',
                color: 'white',
                border: '1px solid #555',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                marginTop: 4
              }}
            >
              Open Notepad
            </button>
          </div>
        )}
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
            {detectiveThoughts.length > 0 ? (
              <ul style={{ color: '#444', paddingLeft: '20px', marginTop: '8px' }}>
                {detectiveThoughts.map((thought, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>
                    {thought}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                No current thoughts. Time to review the evidence and formulate a theory.
              </p>
            )}
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