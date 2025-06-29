// client/src/gameEngine.js
console.log('✅ gameEngine.js loaded');

// ——— Lead Definitions ———
export const leadDefinitions = [
  {
    id: 'blood-analysis',
    description: 'Send the bloodstain sample to the DNA lab for analysis.',
    triggers: { evidenceCollected: ['bloodstain'] }
  },
  {
    id: 'phone-records',
    description: 'Obtain Marvin’s phone records from 2 AM to 4 AM.',
    triggers: { actionsKeywords: ['phone record', 'call log', 'phone records'] }
  },
  {
    id: 'scene-photos',
    description: 'Photograph the crime scene thoroughly.',
    triggers: { actionsKeywords: ['photo', 'photograph', 'picture', 'snap', 'capture', 'pic'] }
  },
  {
    id: 'interview-marvin',
    description: 'Ask Marvin Lott detailed questions about what he heard.',
    triggers: { interviewsCompleted: ['Marvin Lott'] }
  },
  {
    id: 'red-herring-dog-walker',
    description: 'Talk to the dog-walker who was passing by at 3:30 AM.',
    triggers: { actionsKeywords: ['dog-walker', 'neighbor', 'walked'] },
    isRedHerring: true
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

  // preserve evidence
  const newEvidence = gameState.evidence || [];
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

  return { newState, cost, newLeads: unlockedDefs };
}
