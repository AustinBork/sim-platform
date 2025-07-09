// client/src/gameEngine.js
console.log('✅ gameEngine.js loaded');

// ——— Lead Definitions ———
export const leadDefinitions = [
  {
    id: 'scene-photos',
    description: 'Photograph the crime scene thoroughly.',
    narrative: 'The layout and positioning of items may reveal important clues about what happened.',
    triggers: { actionsKeywords: ['photo', 'photograph', 'picture', 'snap', 'capture', 'pic'] }
  },
  {
    id: 'blood-analysis',
    description: 'Send the bloodstain sample to the DNA lab for analysis.',
    narrative: 'The odd pattern of blood spatter on the wall doesn\'t match a simple stabbing. Could provide vital evidence.',
    triggers: { evidenceCollected: ['bloodstain'] }
  },
  {
    id: 'phone-records',
    description: 'Obtain Marvin\'s phone records from 2 AM to 4 AM.',
    narrative: 'His call to 911 came at 3:45 AM, but what was he doing before that? His timing seems convenient.',
    triggers: { actionsKeywords: ['phone record', 'call log', 'phone records'] }
  },
  {
    id: 'interview-marvin',
    description: 'Interview Marvin Lott about what he heard that night.',
    narrative: 'As the reporting witness, his testimony about the timing and what he heard will be crucial.',
    triggers: { interviewsCompleted: ['Marvin Lott'] }
  },
  {
    id: 'victim-background',
    description: 'Research Mia Rodriguez\'s background and connections.',
    narrative: 'Understanding her relationships and recent activities could point to suspects.',
    triggers: { actionsKeywords: ['background', 'research mia', 'victim history', 'about mia'] }
  },
  {
    id: 'knife-analysis',
    description: 'Have the forensics team analyze the knife.',
    narrative: 'The murder weapon is still in place. Fingerprints or DNA could identify our killer.',
    triggers: { actionsKeywords: ['knife', 'murder weapon', 'analyze knife', 'weapon analysis'] }
  },
  {
    id: 'neighbors-canvass',
    description: 'Canvass other neighbors in the building.',
    narrative: 'Someone else might have heard or seen something important that night.',
    triggers: { actionsKeywords: ['canvass', 'other neighbors', 'ask neighbors', 'check neighbors'] }
  },
  {
    id: 'apartment-security',
    description: 'Check building security cameras and entry logs.',
    narrative: 'With no forced entry, how did the killer get in? Security might show who entered the building.',
    triggers: { actionsKeywords: ['security', 'cameras', 'camera footage', 'entry log', 'building security'] }
  },
  {
    id: 'red-herring-dog-walker',
    description: 'Talk to the dog-walker who was passing by at 3:30 AM.',
    narrative: 'A resident mentioned seeing someone walking a dog outside around the time of the murder.',
    triggers: { actionsKeywords: ['dog-walker', 'dog walker', 'walking dog'] },
    isRedHerring: true
  }
];

// ——— Evidence Definitions ———
export const evidenceDefinitions = [
  {
    id: "stab-wound",
    description: "Single stab wound to victim's abdomen",
    discoveredBy: ["photograph room", "examine body", "look at body"]
  },
  {
    id: "no-forced-entry",
    description: "No signs of forced entry on door or windows",
    discoveredBy: ["examine door", "check windows", "photograph room"]
  },
  {
    id: "partial-cleaning",
    description: "Apartment appears partially cleaned",
    discoveredBy: ["examine floor", "check bathroom", "photograph room"]
  },
  {
    id: "missing-phone",
    description: "Victim's phone is missing from the scene",
    discoveredBy: ["check phone", "look for phone", "search belongings"]
  },
  {
    id: "locked-door",
    description: "Door was locked from inside",
    discoveredBy: ["examine door", "check lock", "photograph room"]
  },
  {
    id: "bloodstain",
    description: "Unusual blood spatter pattern on wall",
    discoveredBy: ["examine wall", "check blood", "photograph room"]
  },
  {
    id: "bracelet-charm",
    description: "Small metal charm found under the couch",
    discoveredBy: ["check couch", "look under furniture", "thorough search"]
  }
];

// ——— Constants ———
export const ACTION_COSTS = {
  interview: 20,
  forensics: 360,
  recordPull: 15,
  default: 10
};
export const INTERVIEW_WINDOW = { start: 8, end: 21 }; // 8 AM to 9 PM

// ——— Helper: format minutes to HH:MM ———
export function fmt(totalMins) {
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const m = (totalMins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ——— Helper: interview allowance ———
export function canInterview(gameState, actionText) {
  const now = (7 * 60 + 50) + (gameState.timeElapsed || 0);
  const hour = Math.floor(now / 60);
  const lower = actionText.toLowerCase();
  if (!lower.startsWith('interview')) {
    return { allowed: true };
  }
  if (hour < INTERVIEW_WINDOW.start || hour >= INTERVIEW_WINDOW.end) {
    const reason = hour < INTERVIEW_WINDOW.start
      ? `Too early to interview (current time ${fmt(now)})`
      : `Too late to interview (current time ${fmt(now)})`;
    return { allowed: false, reason };
  }
  return { allowed: true };
}

// ——— Helper: compute action cost ———
export function computeCost(gameState, actionText) {
  const lower = actionText.toLowerCase();
  let base = ACTION_COSTS.default;
  if (lower.includes('interview')) base = ACTION_COSTS.interview;
  else if (lower.includes('forensic') || lower.includes('dna')) base = ACTION_COSTS.forensics;
  else if (lower.includes('pull') || lower.includes('record')) base = ACTION_COSTS.recordPull;
  // extra time for extended interviews
  if (lower.startsWith('interview')) {
    const npc = actionText.slice(9).trim();
    const count = (gameState.interviewCounts?.[npc] || 0) + 1;
    if (count > 5) base += 10;
  }
  return base;
}

// ——— Helper: accusation gating ———
export function canAccuse(gameState) {
  const now = (7 * 60 + 50) + (gameState.timeElapsed || 0);
  if (now < 21 * 60) {
    return { allowed: false, reason: `Must wait until 9 PM on day 1 (current time ${fmt(now)})` };
  }
  return { allowed: true };
}

// ——— Helper: discover evidence ———
export function discoverEvidence(actionText, currentEvidence) {
  const lowerAction = actionText.toLowerCase();
  const newEvidence = [];
  
  // Enhanced room search detection with natural language and typo handling
  const isRoomSearch = 
    // Original exact patterns
    lowerAction.includes("photograph room") || 
    lowerAction.includes("take photos") || 
    lowerAction.includes("photograph scene") || 
    lowerAction.includes("document scene") ||
    lowerAction.includes("take pictures") ||
    
    // Enhanced photo patterns with typos
    lowerAction.includes("pcitures") || 
    lowerAction.includes("picures") || 
    lowerAction.includes("picture") || 
    lowerAction.includes("photo") ||
    lowerAction.includes("pics") ||
    lowerAction.includes("snap") ||
    lowerAction.includes("capture") ||
    
    // Natural language patterns for photography
    (lowerAction.includes("get") && (lowerAction.includes("picture") || lowerAction.includes("photo") || lowerAction.includes("pic") || lowerAction.includes("pcitures"))) ||
    (lowerAction.includes("take") && (lowerAction.includes("picture") || lowerAction.includes("photo") || lowerAction.includes("pic") || lowerAction.includes("pcitures"))) ||
    
    // Scene documentation patterns
    (lowerAction.includes("document") && (lowerAction.includes("place") || lowerAction.includes("scene") || lowerAction.includes("room") || lowerAction.includes("apartment"))) ||
    (lowerAction.includes("record") && (lowerAction.includes("place") || lowerAction.includes("scene") || lowerAction.includes("room") || lowerAction.includes("apartment")));
    
  // Process each evidence definition
  for (const evidence of evidenceDefinitions) {
    // Skip if already discovered
    if (currentEvidence.includes(evidence.id)) continue;
    
    // Check if action triggers this evidence
    const isTriggered = evidence.discoveredBy.some(trigger => 
      lowerAction.includes(trigger)
    );
    
    // Discover evidence if triggered or if doing comprehensive room search
    if (isTriggered || (isRoomSearch && evidence.discoveredBy.includes("photograph room"))) {
      newEvidence.push(evidence.id);
    }
  }
  
  return newEvidence;
}

// ——— Lead Trigger Helper ———
/**
 * Return leadDefinitions whose triggers are satisfied by current state.
 */
export function getNewLeads({ evidence = [], actionsPerformed = [], interviewsCompleted = [], activeLeads = [] }) {
  const newlyUnlocked = [];
  for (const def of leadDefinitions) {
    if (activeLeads.includes(def.id)) continue;
    const { triggers } = def;
    let unlocked = true;
    // evidence triggers
    if (triggers.evidenceCollected) {
      for (const e of triggers.evidenceCollected) {
        if (!evidence.includes(e)) { unlocked = false; break; }
      }
    }
    // action keyword triggers
    if (unlocked && triggers.actionsKeywords) {
      const performedText = actionsPerformed.join(' ');
      if (!triggers.actionsKeywords.some(kw => performedText.includes(kw))) {
        unlocked = false;
      }
    }
    // interview triggers
    if (unlocked && triggers.interviewsCompleted) {
      for (const npc of triggers.interviewsCompleted) {
        if (!interviewsCompleted.includes(npc)) { unlocked = false; break; }
      }
    }
    if (unlocked) newlyUnlocked.push(def);
  }
  return newlyUnlocked;
}

// ——— Core: Apply Action ———
export function applyAction(gameState = {}, actionText = '') {
  console.log('🔍 [applyAction] actionText:', actionText.toLowerCase());

  // check interview window
  const interviewCheck = canInterview(gameState, actionText);
  if (!interviewCheck.allowed) {
    return { error: interviewCheck.reason };
  }

  // compute cost & time
  const cost = computeCost(gameState, actionText);
  const newElapsed = (gameState.timeElapsed || 0) + cost;
  const newRemaining = (gameState.timeRemaining || 48 * 60) - cost;

  // update performed actions and interviews
  const prevActions = gameState.actionsPerformed || [];
  const newActions = [...prevActions, actionText.toLowerCase()];
  const prevInterviews = gameState.interviewsCompleted || [];
  const newInterviewCounts = { ...(gameState.interviewCounts || {}) };
  const newInterviews = [...prevInterviews];
  if (actionText.toLowerCase().startsWith('interview')) {
    const npc = actionText.slice(9).trim();
    newInterviewCounts[npc] = (newInterviewCounts[npc] || 0) + 1;
    if (!newInterviews.includes(npc)) newInterviews.push(npc);
  }

  // preserve evidence and discover new evidence
  const prevEvidence = gameState.evidence || [];
  const discoveredEvidence = discoverEvidence(actionText, prevEvidence);
  const newEvidence = [...prevEvidence, ...discoveredEvidence];
  
  const prevLeads = gameState.leads || [];

  // instrument state before triggers
  console.log('🔍 state before getNewLeads:', {
    evidence: newEvidence,
    actionsPerformed: newActions,
    interviewsCompleted: newInterviews,
    activeLeads: prevLeads
  });

  // unlock new leads
  const unlockedDefs = getNewLeads({
    evidence: newEvidence,
    actionsPerformed: newActions,
    interviewsCompleted: newInterviews,
    activeLeads: prevLeads
  });
  console.log('🔍 getNewLeads returned:', unlockedDefs.map(d => d.id));

  // merge leads
  const mergedLeads = Array.from(new Set([...prevLeads, ...unlockedDefs.map(d => d.id)]));
  console.log('🔍 mergedLeads:', mergedLeads);

  // build new state
  const newState = {
    ...gameState,
    timeElapsed: newElapsed,
    timeRemaining: newRemaining,
    actionsPerformed: newActions,
    interviewsCompleted: newInterviews,
    interviewCounts: newInterviewCounts,
    evidence: newEvidence,
    leads: mergedLeads
  };

  return { 
    newState, 
    cost, 
    newLeads: unlockedDefs,
    discoveredEvidence
  };
}