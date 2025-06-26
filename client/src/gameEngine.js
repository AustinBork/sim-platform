// client/src/gameEngine.js

// Constants
const START_OF_DAY = 7 * 60 + 50; // 7:50 AM in minutes

// Action time costs (minutes)
export const ACTION_COSTS = {
  interview: 20,
  forensics: 360,
  recordPull: 15,
  default: 10
};

// Allowed interview window (inclusive hours)
export const INTERVIEW_WINDOW = { start: 8, end: 21 }; // 8 AM to 9 PM

// Hard-coded action → lead unlocks
export const LEAD_UNLOCKS = {
  'bag the bloodstain': ['Send blood sample to lab'],
  'photograph the room': ['Review photos for trace evidence'],
  'interview marvin lott': ['Follow up on neighbor’s timeline'],
  'pull phone records': ['Analyze Mia’s call logs at 3:30 AM']
};

// Helper: format minutes since midnight into HH:MM
export function fmt(totalMins) {
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const m = (totalMins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Determine if an interview is allowed at current game state
export function canInterview(gameState, actionText) {
  const now = START_OF_DAY + gameState.timeElapsed;
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

// Compute action cost (including extra interview questions)
export function computeCost(gameState, actionText) {
  const lower = actionText.toLowerCase();
  let base = ACTION_COSTS.default;

  if (lower.includes('interview')) base = ACTION_COSTS.interview;
  else if (lower.includes('forensic') || lower.includes('dna')) base = ACTION_COSTS.forensics;
  else if (lower.includes('pull') || lower.includes('record')) base = ACTION_COSTS.recordPull;

  // extra time if >5 questions in an interview
  if (lower.startsWith('interview')) {
    const npc = actionText.slice(9).trim();
    const count = (gameState.interviewCounts[npc] || 0) + 1;
    if (count > 5) base += 10;
  }

  return base;
}

// Unlock leads based on action text
export function unlockLeads(gameState, actionText) {
  const lower = actionText.toLowerCase();
  const newLeads = LEAD_UNLOCKS[lower] || [];
  // Merge unique leads
  const merged = Array.from(new Set([...gameState.leads, ...newLeads]));
  return merged;
}

// Determine if accusation is allowed (after first-day 9 PM)
export function canAccuse(gameState) {
  // Calculate current absolute clock minutes
  const now = START_OF_DAY + gameState.timeElapsed;
  // First-day 9 PM absolute minute: 21*60
  if (now < 21 * 60) {
    return { allowed: false, reason: `Must wait until 9 PM on day 1 (current time ${fmt(now)})` };
  }
  // Additional gating by required leads could be added here
  return { allowed: true };
}

// Apply an action: updates gameState & returns new state and cost
export function applyAction(gameState, actionText) {
  // Check interview allowance
  const interviewCheck = canInterview(gameState, actionText);
  if (!interviewCheck.allowed) {
    return { error: interviewCheck.reason };
  }

  // Compute cost and update times
  const cost = computeCost(gameState, actionText);
  const newElapsed = gameState.timeElapsed + cost;
  const newRemaining = gameState.timeRemaining - cost;

  // Update interview counts
  let newInterviewCounts = { ...gameState.interviewCounts };
  if (actionText.toLowerCase().startsWith('interview')) {
    const npc = actionText.slice(9).trim();
    newInterviewCounts[npc] = (newInterviewCounts[npc] || 0) + 1;
  }

  // Unlock leads
  const newLeads = unlockLeads(gameState, actionText);

  // Preserve evidence and messages
  const newState = {
    ...gameState,
    timeElapsed: newElapsed,
    timeRemaining: newRemaining,
    interviewCounts: newInterviewCounts,
    leads: newLeads
  };

  return { newState, cost };
}
