# Sim Platform Starter

Run `npm install` to get started.

# SIM Platform

This is a local AI simulation platform built using React + Vite for the frontend and Node.js for a proxy backend. It supports immersive gameplay powered by OpenRouter Claude AI.

## Setup

1. Clone the repo  
   `git clone https://github.com/AustinBork/sim-platform.git`

2. Install dependencies  
npm install
cd client
npm install

css
Copy

3. Add a `.env` file to the root with:
VITE_OPENROUTER_API_KEY=your-key-here
PORT=3001

yaml
Copy

4. Run it locally  
`npm run dev`

---

Then save, close, and push it:

```powershell
git add README.md
git commit -m "Add README with setup instructions"
git push




Overview of the System
From the code and screenshots, I can see a detective game called "First 48: Homicide Investigation" where the player takes on the role of a detective solving a murder case. The system includes:

A React frontend (App.js) that handles the game UI and state
A proxy server (proxy-server.cjs) that interfaces with an AI model to generate character dialogue
A game engine (gameEngine.js) that manages game mechanics and state changes
Terminal logs showing communication issues between components

Current State from Screenshots

Image 1: The main game interface showing dialogue with Marvin Lott (neighbor) and Navarro (partner). Appears to be working, but there's an issue with the speaker attribution where dialogue from Marvin is coming from Navarro.
Image 2: The Notepad feature showing case timeline, with missing evidence and suspect information.
Image 3: A more detailed Detective's Notepad showing thoughts, evidence collection status, and the case timeline.

Key Issues Identified
1. Dialogue Attribution Issues
In the logs, there's confusion about who should be speaking. For example:
🔴 RAW MODEL OUTPUT: *Marvin shifts nervously, glancing down the hallway as if he's expecting someone to appear.*  

I… I didn't know her that well, but Mia was always friendly. She kept to herself mostly. I've seen her with different people coming in and out at odd hours. One guy seemed a bit aggressive, always arguing with her. I never thought it could come to this, though.
📝 No JSON found, parsing natural text
The response is clearly from Marvin but gets attributed to Navarro in the UI.
2. JSON Parsing Issues
The proxy server is trying to parse responses in a specific JSON format, but the model sometimes responds in natural text format instead:
📝 No JSON found, parsing natural text
3. Character State Management Issues
The conversation state isn't being properly tracked or updated:
🎭 detectSpeakerFromContext called with gameState: {
  "conversation": {
    "character": "Marvin Lott",
    "state": "RETURNING",
    "topicsDiscussed": [
      "noise",
      "timing",
      "victim",
      "witness"
    ]
  },
  "pendingAction": "MOVE_TO_CHARACTER",
  "currentCharacter": "Marvin Lott"
}
Yet the response handling doesn't properly track this state.
4. Evidence and Lead Collection Not Triggering
Despite actions to investigate the scene, no evidence or leads are being collected.
5. Notification System Issues
The notification system for new leads and evidence is implemented but not being triggered.
6. Missing or Inconsistent Game State Updates
When performing actions, the state isn't being fully updated or persisted.
Comprehensive Fix Game Plan
1. Fix Dialogue Attribution System
Issue: The natural language responses from the AI aren't being properly parsed, causing dialogue attribution errors.
Fix:

Enhance the parsing logic in proxy-server.cjs to better identify speaker from context
Strengthen the JSON parsing fallback to consider formats like Speaker: Text when JSON isn't present
Add validation to ensure the speaker matches the current conversation participant
Modify the response handling in App.js to respect the conversation state

javascript// In proxy-server.cjs - improve the natural text parsing
if (!foundValidJSON) {
  // Enhanced speaker detection regex to handle more formats
  const speakerRegex = /^(?:\*.*?\*\s*)?(Navarro|Marvin Lott|Rachel Kim|Jordan Valez)(?:\s*:|:)(.+)$/s;
  const dialogueMatch = remainingText.match(speakerRegex);
  
  if (dialogueMatch) {
    result.push({
      type: 'dialogue',
      speaker: dialogueMatch[1],
      text: dialogueMatch[2].trim()
    });
  } else if (remainingText.trim().length > 0) {
    // If no explicit speaker is found, use the expected speaker from context
    result.push({
      type: 'dialogue',
      speaker: suggestedSpeaker,
      text: remainingText.trim()
    });
  }
}
2. Fix Conversation State Management
Issue: The conversation state isn't being properly maintained between turns.
Fix:

Ensure conversationState is consistently updated after each interaction
Fix the isEndingConversation detection in App.js
Add stronger state transitions between GREETING, QUESTIONING, and CONCLUDING phases
Ensure context is properly passed to the AI model

javascript// In App.js - better conversation state updates
const updateConversationState = (messageText, dialogueResponse) => {
  setConversationState(prev => {
    // If starting new conversation with character
    if (dialogueResponse.speaker !== 'Navarro' && prev.currentCharacter !== dialogueResponse.speaker) {
      return {
        ...prev,
        currentCharacter: dialogueResponse.speaker,
        conversationPhase: 'GREETING',
        characters: {
          ...prev.characters,
          [dialogueResponse.speaker]: {
            state: 'INITIAL',
            topicsDiscussed: []
          }
        }
      };
    }
    
    // If continuing conversation
    if (dialogueResponse.speaker !== 'Navarro' && prev.currentCharacter === dialogueResponse.speaker) {
      // Extract topics from dialogue
      const topics = extractTopics(messageText);
      
      return {
        ...prev,
        conversationPhase: isEndingConversation(messageText, prev) ? 'CONCLUDING' : 'QUESTIONING',
        characters: {
          ...prev.characters,
          [dialogueResponse.speaker]: {
            state: 'FOLLOWING_UP',
            topicsDiscussed: [
              ...(prev.characters[dialogueResponse.speaker]?.topicsDiscussed || []),
              ...topics
            ]
          }
        }
      };
    }
    
    // If conversation is ending
    if (isEndingConversation(messageText, prev)) {
      return {
        ...prev,
        conversationPhase: 'CONCLUDING'
      };
    }
    
    return prev;
  });
};
3. Fix Evidence and Lead Collection
Issue: Actions to investigate the scene aren't triggering evidence collection or lead updates.
Fix:

Debug the evidence discovery logic in gameEngine.js
Fix the applyAction function to properly process evidence and lead collection
Update the action recognition system to better detect investigative actions
Ensure discovered evidence gets properly added to state

javascript// In App.js - add action handling middleware
const handleUserAction = (actionText) => {
  // Process the action using gameEngine
  const result = applyAction({
    timeElapsed,
    timeRemaining,
    evidence,
    leads,
    actionsPerformed,
    interviewsCompleted,
    interviewCounts
  }, actionText);
  
  if (result.error) {
    setMsgs(m => [...m, { speaker: 'Navarro', content: `❌ ${result.error}` }]);
    return;
  }
  
  // Update all state variables
  setTimeElapsed(result.newState.timeElapsed);
  setTimeRemaining(result.newState.timeRemaining);
  setEvidence(result.newState.evidence);
  setLeads(result.newState.leads);
  setActionsPerformed(result.newState.actionsPerformed);
  setInterviewsCompleted(result.newState.interviewsCompleted);
  setInterviewCounts(result.newState.interviewCounts);
  
  // Add notifications for new discoveries
  if (result.discoveredEvidence && result.discoveredEvidence.length > 0) {
    result.discoveredEvidence.forEach(evidenceId => {
      const evidenceDef = evidenceDefinitions.find(e => e.id === evidenceId);
      if (evidenceDef) {
        setPendingNotifications(n => [...n, { 
          type: 'evidence', 
          item: evidenceDef 
        }]);
      }
    });
  }
  
  if (result.newLeads && result.newLeads.length > 0) {
    result.newLeads.forEach(leadDef => {
      setPendingNotifications(n => [...n, { 
        type: 'lead', 
        item: leadDef 
      }]);
    });
  }
};
4. Fix Action Detection and Processing
Issue: The game isn't properly detecting and processing player actions.
Fix:

Improve action recognition in sendMessage to identify when the player is examining evidence, interviewing, etc.
Add a preprocessing step to analyze the input text and determine the intended action
Fix the middleware between the frontend and the proxy server

javascript// In App.js - enhance sendMessage with action detection
const sendMessage = async () => {
  if (!input.trim()) return;
  
  const actionText = input.trim();
  setMsgs(m => [...m, { speaker: detectiveName, content: actionText }]);
  setLoading(true);
  setInput('');
  
  // Detect if this is an investigative action
  const isInvestigativeAction = isGeneralInvestigativeAction(actionText);
  
  // Check if talking to someone specific
  const mentionedCharacter = detectCharacterMention(actionText, conversationState);
  
  try {
    // If this is an investigative action, process it before AI response
    if (isInvestigativeAction) {
      handleUserAction(actionText);
      
      // Add Navarro's affirmation for the action
      const affirmation = getNavarroAffirmation(actionText);
      setMsgs(m => [...m, { speaker: 'Navarro', content: affirmation }]);
    }
    
    // If starting conversation with character, update state
    if (mentionedCharacter && mentionedCharacter !== conversationState.currentCharacter) {
      setConversationState(prev => ({
        ...prev,
        currentCharacter: mentionedCharacter,
        pendingAction: 'MOVE_TO_CHARACTER',
        conversationPhase: 'GREETING'
      }));
    }
    
    // Continue with AI response request
    // ... existing AI request code ...
  } catch (err) {
    // ... error handling ...
  } finally {
    setLoading(false);
  }
};
5. Fix Notification System
Issue: The notification system for new leads and evidence is implemented but not triggering.
Fix:

Ensure the setPendingNotifications calls are working correctly
Debug the processPendingNotifications function
Fix timing between processing notifications and updating the UI

javascript// In App.js - enhance the notification display
useEffect(() => {
  if (pendingNotifications.length > 0) {
    // Schedule processing after a short delay to ensure dialogues are rendered first
    const timer = setTimeout(() => {
      processPendingNotifications();
    }, 800);
    
    return () => clearTimeout(timer);
  }
}, [pendingNotifications]);
6. Fix State Persistence and Save/Load
Issue: Game state isn't being properly saved or loaded.
Fix:

Update the saveGame function to include all necessary state
Fix the loadGame function to properly restore all state variables
Add validation to ensure saved state is compatible with current game version

javascript// In App.js - comprehensive save game function
const saveGame = () => {
  const toSave = {
    version: "1.0", // Add version for future compatibility
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
    conversationState,
    notes,
    detectiveThoughts,
    // Add any other state that needs to be preserved
  };
  
  try {
    localStorage.setItem('first48_save', JSON.stringify(toSave));
    setHasSave(true);
    setSavedState(toSave);
    setMsgs(m => [...m, { 
      speaker: 'System', 
      content: 'Game saved successfully.' 
    }]);
  } catch (err) {
    console.error('Failed to save game:', err);
    setMsgs(m => [...m, { 
      speaker: 'System', 
      content: 'Failed to save game. Please try again.' 
    }]);
  }
};
7. Fix JSON Processing in Proxy Server
Issue: The OpenAI response parsing is inconsistent.
Fix:

Strengthen the prompt to consistently get JSON-formatted responses
Add robust parsing that handles both JSON and natural language
Add retry logic for malformed responses

javascript// In proxy-server.cjs - enhance system prompt to enforce JSON format
const systemPrompt = `
You are the dialogue engine for "First 48: The Simulation," a detective investigation game.
...

CRITICAL RESPONSE FORMAT:
You MUST respond with each of the following on separate lines:
1. A stage direction as a JSON object: {"type":"stage","description":"<action description>"}
2. A character's dialogue as a JSON object: {"type":"dialogue","speaker":"${suggestedSpeaker}","text":"<their line>"}

Each JSON object MUST be on its own line with no additional text. Do not include any other formatting, markdown, or text outside these JSON objects.
...
`;

// Add retry logic for malformed responses
if (!foundValidJSON && retryCount < 2) {
  console.log('⚠️ No valid JSON found, retrying with clearer instructions...');
  // Retry with even more explicit instructions
  return makeRequest(messages, retryCount + 1);
}
Implementation Strategy

Fix Critical Path First:

Start with the dialogue attribution issues as they directly impact gameplay
Then address evidence/lead collection which is core to progression


Add Debugging Tools:

Implement a debug panel that shows the current state
Add verbose logging that can be toggled on/off


Fix Game Logic:

Implement all the conversation state fixes
Fix the action detection and processing
Repair the evidence and lead triggers


UI and Polish:

Fix notification system
Enhance save/load functionality
Add any missing UI elements


Testing Protocol:

Create a test scenario that exercises all core mechanics
Verify proper state transitions between scenes
Confirm evidence/lead collection works as expected
Test conversation flows with all characters



Final Recommendations

Refactor for Robustness: The current tight coupling between components makes debugging difficult. Consider refactoring to use a more state-driven approach like Redux or Context API.
AI Response Improvements: The AI responses need more structure and consistency. Consider using a more structured approach with defined response templates.
Fallback Mechanisms: Add more robust fallback mechanisms when components fail to communicate properly.
Documentation: Add better documentation for the game mechanics and expected behavior to make future debugging easier.

This comprehensive fix should address all the major issues with the game and get it back to a fully functional state. The approach focuses on fixing the core mechanics first and then addressing UI and polish issues.