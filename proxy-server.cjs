// proxy-server.cjs

const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Load case data
const caseData = require('./server/caseData.json');
// Load character knowledge
const characterKnowledgePath = path.join(__dirname, './client/src/characterKnowledge.js');
let characterKnowledge = {};

// Try to load character knowledge, create a fallback if not available
try {
  // Since characterKnowledge.js is an ES module and we're in CommonJS, we need to read it as text
  const characterKnowledgeText = fs.readFileSync(characterKnowledgePath, 'utf8');
  // This is a simple extraction of the object, not a full JS parser
  const objectMatch = characterKnowledgeText.match(/const characterKnowledge = ({[\s\S]*?});/);
  if (objectMatch && objectMatch[1]) {
    // Evaluate the object in a controlled way (in production, consider a safer approach)
    characterKnowledge = eval(`(${objectMatch[1]})`);
  }
} catch (err) {
  console.warn('Could not load character knowledge file:', err.message);
  // Create minimal fallback knowledge
  characterKnowledge = {
    "Navarro": {
      role: "Detective Partner",
      personality: { traits: ["experienced", "helpful"] },
      knowledge: { initialObservations: ["Single stab wound", "No forced entry"] }
    },
    "Marvin Lott": {
      role: "Neighbor",
      personality: { traits: ["nervous", "helpful"] },
      knowledge: { 
        initialStatement: ["Heard a scream around 3:30 AM", "Called 911 shortly after"],
        followUpInfo: {
          aboutNight: ["The scream was short", "Waited before calling 911"]
        }
      }
    },
    "Rachel Kim": {
      role: "Best Friend",
      personality: { traits: ["distraught", "helpful", "secretive"] },
      knowledge: {
        initialStatement: ["Found the body at 8:00 AM", "Was supposed to meet Mia for breakfast"],
        followUpInfo: {
          aboutRelationship: ["They were very close", "Rachel noticed Jordan's jealousy"]
        },
        hiddenKnowledge: ["Actually killed Mia", "Called Mia at 7:25 AM before 'finding' the body"]
      }
    },
    "Jordan Valez": {
      role: "Ex-Boyfriend",
      personality: { traits: ["defensive", "volatile", "genuinely grieving"] },
      knowledge: {
        initialStatement: ["Was at The Lockwood Bar until midnight", "Has Uber receipt as proof"],
        followUpInfo: {
          aboutRelationship: ["Had restraining order in past", "Recently started talking to Mia again"]
        }
      }
    }
  };
}

// Ensure we have an array of suspects
const suspectList = Array.isArray(caseData.suspects) ? caseData.suspects : 
  (caseData.solved && caseData.solved.killer ? [caseData.solved.killer] : []);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper: Analyze approach style (aggressive vs. empathetic)
function analyzeApproachStyle(message) {
  const text = message.toLowerCase();
  
  // Aggressive indicators
  const aggressivePatterns = [
    'demand', 'tell me', 'now', 'confess', 'lying', 'liar', 'explain yourself',
    'i know you', 'admit', '!', '!!', 'yell', 'shout', 'threaten'
  ];
  
  // Empathetic indicators
  const empatheticPatterns = [
    'please', 'understand', 'help us', 'would you mind', 'if you could', 
    'appreciate', 'thank you', 'sorry', 'difficult', 'must be hard'
  ];
  
  let aggressiveScore = 0;
  let empatheticScore = 0;
  
  aggressivePatterns.forEach(pattern => {
    if (text.includes(pattern)) aggressiveScore++;
  });
  
  empatheticPatterns.forEach(pattern => {
    if (text.includes(pattern)) empatheticScore++;
  });
  
  if (aggressiveScore > empatheticScore + 1) return 'aggressive';
  if (empatheticScore > aggressiveScore + 1) return 'empathetic';
  return 'neutral';
}

// Helper: Detect which character should speak next based on context
function detectSpeakerFromContext(messages, gameState, allCharacters) {
  console.log('🎭 detectSpeakerFromContext called with gameState:', JSON.stringify(gameState, null, 2));
  
  // If we have an explicit character from conversation state, use that
  if (gameState.conversation && gameState.conversation.character) {
    console.log(`🎭 Using conversation state character: ${gameState.conversation.character}`);
    return gameState.conversation.character;
  }
  
  // Check for MOVE_TO_CHARACTER pendingAction
  if (gameState.pendingAction === 'MOVE_TO_CHARACTER' && gameState.currentCharacter) {
    console.log(`🎭 Moving to character: ${gameState.currentCharacter}`);
    return gameState.currentCharacter;
  }
  
  // If we have a pending action that's ASK_NAVARRO, force Navarro
  if (gameState.pendingAction === 'ASK_NAVARRO') {
    console.log(`🎭 Action requires Navarro to speak`);
    return "Navarro";
  }
  
  // If ending conversation, use the current character if available
  if (gameState.pendingAction === 'END_CONVERSATION' && gameState.currentCharacter) {
    console.log(`🎭 Ending conversation with: ${gameState.currentCharacter}`);
    return gameState.currentCharacter;
  }
  
  // CRITICAL FIX: If we have currentCharacter, prioritize that over message parsing
  // This maintains conversation context during aggressive/accusatory dialogue
  if (gameState.currentCharacter && gameState.currentCharacter !== 'Navarro') {
    console.log(`🎭 Maintaining conversation with current character: ${gameState.currentCharacter}`);
    return gameState.currentCharacter;
  }
  
  // Get the last few messages for context
  const recentMessages = messages.slice(-3);
  
  // Look for patterns that indicate who should speak next
  for (const msg of recentMessages) {
    if (!msg.content) continue;
    const content = msg.content.toLowerCase();
    
    // Check for door knocking or approaching a character
    for (const character of allCharacters) {
      const characterLower = character.toLowerCase();
      if (
        content.includes(`knock on ${characterLower}'s door`) ||
        content.includes(`approaches ${characterLower}`) ||
        content.includes(`talk to ${characterLower}`) ||
        content.includes(`speak to ${characterLower}`) ||
        content.includes(`interview ${characterLower}`) ||
        content.includes(`speaking with ${characterLower}`) ||
        content.includes(`talking to ${characterLower}`) ||
        content.includes(`ask ${characterLower}`)
      ) {
        console.log(`🎭 Context suggests ${character} should speak next`);
        return character;
      }
    }
    
    // Check for standard patterns
    if (
      content.includes("marvin lott's door") || 
      content.includes("marvin's door") ||
      content.includes("neighbor") && content.includes("door")
    ) {
      return "Marvin Lott";
    }
    
    if (
      content.includes("rachel kim's") || 
      content.includes("rachel's") ||
      content.includes("best friend") && content.includes("talk")
    ) {
      return "Rachel Kim";
    }
    
    if (
      content.includes("jordan's") || 
      content.includes("ex-boyfriend") ||
      content.includes("ex boyfriend") ||
      content.includes("valez")
    ) {
      return "Jordan Valez";
    }
  }
  
  // Default to Navarro if no specific character is detected
  return "Navarro";
}

// Generate conversation context for character continuity
// Generate conversation context for character continuity
function generateConversationContext(character, gameState) {
  // Get character knowledge
  const characterInfo = characterKnowledge[character] || {};
  
  // Base context for all conversations
  let context = `
CHARACTER BACKGROUND AND KNOWLEDGE:
${character === "Navarro" ? 
      `You are Detective Navarro, an experienced homicide detective and the partner of Detective ${gameState.detectiveName}.
You have a world-weary demeanor but are loyal and dedicated to solving cases.` :
      `You are ${character}, ${characterInfo.role || "a character"} in this case.
${characterInfo.personality ? `Personality: ${characterInfo.personality.traits?.join(", ")}` : ""}`
}`;

  // Add character-specific knowledge
  if (character === "Marvin Lott") {
    context += `
WHAT YOU KNOW:
- You are the neighbor who called 911 after hearing a scream around 3:30 AM
- You live next door to Mia Rodriguez, the victim
- You heard what sounded like furniture moving shortly after the scream
- You waited about 15 minutes before calling 911 because you weren't sure
- You sometimes saw Mia with visitors, including a woman who visited frequently and a man who had arguments with her
- You believe you might have seen someone leaving the building around 3:45 AM`;
  } else if (character === "Rachel Kim") {
    context += `
WHAT YOU KNOW:
- You are Mia's best friend (and secretly her killer)
- You're pretending to be distraught about her death
- You're claiming you found the body at 8:00 AM when you came to pick her up for breakfast
- You're trying to deflect suspicion toward Jordan (Mia's ex-boyfriend)
- You killed Mia because she was rekindling her relationship with Jordan
- The truth is that you called Mia at 7:25 AM, before you "found" the body
- You left a bracelet charm at the scene accidentally`;
  } else if (character === "Jordan Valez") {
    context += `
WHAT YOU KNOW:
- You are Mia's ex-boyfriend
- You had a restraining order against you in the past, but claim it was a misunderstanding
- You were at The Lockwood Bar until midnight on the night of the murder (verifiable by Uber receipt)
- You and Mia had recently started talking again, which made Rachel jealous
- You noticed Rachel was overly involved in your relationship with Mia`;
  } else if (character === "Navarro") {
    // Add case knowledge for Navarro based on current evidence and leads
    context += `
CASE KNOWLEDGE:
- The victim is Mia Rodriguez, 26 years old
- Found stabbed in her apartment
- No sign of forced entry
- Estimated time of death: between 2:00-4:00 AM
- Neighbor (Marvin Lott) heard a scream at approximately 3:30 AM

${gameState.evidence?.length > 0 ? `EVIDENCE SO FAR:\n- ${gameState.evidence.join('\n- ')}` : ''}
${gameState.leads?.length > 0 ? `LEADS SO FAR:\n- ${gameState.leads.join('\n- ')}` : ''}`;
  }

  // Add conversation state-specific context
  if (gameState.conversationPhase === 'GREETING' || 
      (!gameState.conversation || gameState.conversation.state === 'INITIAL')) {
    // First time meeting
    context += `
IMPORTANT: This is your FIRST conversation with the detective. React appropriately surprised/concerned about being questioned.`;
  } 
  else if (gameState.conversationPhase === 'QUESTIONING' && gameState.conversation?.state === 'RETURNING') {
    // Returning to character after speaking with them before
    context += `
IMPORTANT: The detective is returning to speak with you after a previous conversation. Acknowledge that you've spoken before.`;
  }
  else if (gameState.conversationPhase === 'QUESTIONING' && gameState.conversation?.state === 'FOLLOWING_UP') {
    // Follow-up questions in same conversation
    context += `
CONVERSATION CONTEXT:
You are continuing a conversation with Detective ${gameState.detectiveName}.
${gameState.conversation.topicsDiscussed && gameState.conversation.topicsDiscussed.length > 0 ? 
      `You have already discussed: ${gameState.conversation.topicsDiscussed.join(", ")}` : 
      "The detective is asking follow-up questions."
}

IMPORTANT: Do NOT repeat information you've already shared unless specifically asked to clarify something. Provide NEW details about any topic the detective asks about.`;

    // Add character-specific follow-up hints
    if (character === "Marvin Lott" && 
        gameState.conversation.topicsDiscussed && 
        gameState.conversation.topicsDiscussed.includes('noise')) {
      context += `
If pressed about what else you remember, mention:
- You think you saw someone leaving the building - a woman who looked like the one who often visited Mia
- You couldn't see her face clearly, but she seemed to be in a hurry`;
    }
    
    if (character === "Rachel Kim" &&
        gameState.conversation.topicsDiscussed &&
        gameState.conversation.topicsDiscussed.includes('timing')) {
      context += `
If pressed about the timing of finding the body:
- Get slightly defensive
- Maintain that you arrived at 8:00 AM for breakfast
- Deflect by suggesting the detective look into Jordan's anger issues`;
    }
    
    if (character === "Jordan Valez" &&
        gameState.conversation.topicsDiscussed &&
        gameState.conversation.topicsDiscussed.includes('relationships')) {
      context += `
If pressed about your relationship with Mia:
- Acknowledge that things were complicated between you
- Emphasize that you were working on rebuilding trust
- Mention that Rachel seemed possessive of Mia's time and attention`;
    }
  }
  
  // Handle conversation ending
  if (gameState.conversationPhase === 'CONCLUDING') {
    context += `
IMPORTANT: The detective is ending the conversation with you. React appropriately (saying goodbye, offering to help further if needed, etc.)`;
  }
  
  return context;
}

// Main route for chat interaction
app.post('/chat', async (req, res) => {
  const { messages, gameState } = req.body;
  
  console.log('💬 Received game state:', gameState);
  console.log('💬 Last message:', messages[messages.length - 1]);
  console.log('🔍 DEBUG: pendingAction =', gameState.pendingAction);
  console.log('🔍 DEBUG: currentCharacter =', gameState.currentCharacter);
  
  // Build list of all possible characters
  const allCharacters = ["Navarro", "Marvin Lott", "Rachel Kim", "Jordan Valez"];
  
  // Detect who should speak based on context
  const suggestedSpeaker = detectSpeakerFromContext(messages, gameState, allCharacters);
  console.log(`🎭 Suggested next speaker: ${suggestedSpeaker}`);
  
  // Analyze the player's approach style (for responsive NPC behavior)
  const lastMessage = messages[messages.length - 1]?.content || '';
  const approachStyle = analyzeApproachStyle(lastMessage);
  console.log(`👤 Player approach style: ${approachStyle}`);
  
  // Generate character-specific conversation context
  const conversationContext = generateConversationContext(suggestedSpeaker, gameState);
  
  // Build the system prompt with improved instructions
  // Build the system prompt with improved instructions
  const systemPrompt = `
You are the dialogue engine for "First 48: The Simulation," a detective investigation game.
Case: ${caseData.title || "The Murder of Mia Rodriguez"}
Current time: ${gameState.currentTime || 'Unknown'}
Remaining time: ${gameState.timeRemaining || 'Unknown'}
Evidence: ${gameState.evidence?.join(', ') || 'None yet'}
Leads: ${gameState.leads?.join(', ') || 'None yet'}

CRITICAL DIALOGUE FORMAT INSTRUCTIONS:
${gameState.pendingAction === 'MOVE_TO_CHARACTER' ? 
`You MUST respond with ONLY dialogue - NO stage directions. Use this format:
{"type":"dialogue","speaker":"${suggestedSpeaker}","text":"<their line>"}

DO NOT include any stage directions. The detective has already approached and knocked on the door.` :
`You MUST respond using ONLY the following sequence of JSON objects, each on its own line:

1. First, a stage direction: {"type":"stage","description":"<action description>"}
2. Then, a character's dialogue: {"type":"dialogue","speaker":"${suggestedSpeaker}","text":"<their line>"}

DO NOT include any text, explanations, or commentary outside these JSON objects.`}
DO NOT use markdown formatting, asterisks, or any other non-JSON syntax.
The speaker MUST be "${suggestedSpeaker}" unless there is a compelling reason for another character to interject.

${conversationContext}

${gameState.pendingAction === 'MOVE_TO_CHARACTER' ? 
    `The detective has already approached ${suggestedSpeaker} and knocked on the door. DO NOT generate any stage directions - only generate dialogue. Have ${suggestedSpeaker} respond to the door knock as if greeting the detective for the first time.` :
    gameState.pendingAction === 'CONTINUE_CONVERSATION' ?
    `The detective is continuing the conversation with ${suggestedSpeaker}. Have ${suggestedSpeaker} respond to the detective's question with new information that hasn't been shared before.` :
    gameState.pendingAction === 'END_CONVERSATION' ?
    `The detective is ending the conversation with ${suggestedSpeaker}. Have ${suggestedSpeaker} say goodbye appropriately.` :
    gameState.pendingAction === 'ASK_NAVARRO' ?
    `The detective is asking for your professional opinion as Navarro. Provide insightful detective commentary based on the evidence and leads so far.` :
    `Respond to the detective's action with appropriate stage direction and dialogue.`
}

Character response style: ${approachStyle === 'aggressive' ? 
  `${suggestedSpeaker} becomes defensive and less forthcoming due to the detective's aggressive approach.` : 
  approachStyle === 'empathetic' ? 
  `${suggestedSpeaker} appreciates the detective's empathetic approach and provides more detailed information.` : 
  `${suggestedSpeaker} responds naturally to the detective's neutral approach.`}

IMPORTANT: Your response must maintain continuity with previous dialogue. The character should not repeat information they've already provided unless specifically asked to clarify.

CONVERSATION MEMORY: For characters other than Navarro, recall previous interactions and reference them naturally. If this is a follow-up conversation, the character should acknowledge having spoken to the detective before.

MOOD AND EMOTION: Each character has specific emotional states based on their role in the story. Convey these emotions through dialogue style, word choice, and small behavioral details in stage directions.

Ensure each JSON object is on its own line with no additional text.
`;

  // Build messages for OpenAI
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

 try {
  console.log('🔄 Sending request to OpenAI...');
  const response = await openAI.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: chatMessages
  });
  const text = response.choices[0].message.content;
  console.log('🔴 RAW MODEL OUTPUT:', text);
  console.log('🔴 OUTPUT LENGTH:', text.length);
  console.log('🔴 OUTPUT FIRST 100 CHARS:', text.substring(0, 100));
  console.log('🔴 OUTPUT LAST 100 CHARS:', text.substring(Math.max(0, text.length - 100)));
  
  // IMPROVED: Enhanced parsing for both JSON and text formats
  let result = [];
  
  // Method 1: Try to parse as JSON lines first
  const lines = text.trim().split(/\r?\n/);
  let foundValidJSON = false;
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && (parsed.type === 'stage' || parsed.type === 'dialogue')) {
        result.push(parsed);
        foundValidJSON = true;
      }
    } catch {
      // Not JSON, continue
    }
  }
  
  // Method 2: If no valid JSON found, use enhanced text parsing
  if (!foundValidJSON) {
    console.log('📝 No JSON found, using enhanced natural text parsing');
    
    // Extract stage directions (text in asterisks)
    const stageMatches = text.match(/\*([^*]+)\*/g);
    let remainingText = text;
    
    if (stageMatches && stageMatches.length > 0) {
      // Process the first stage direction
      const stageContent = stageMatches[0].replace(/^\*|\*$/g, '').trim();
      result.push({
        type: 'stage',
        description: stageContent
      });
      
      // Remove the processed stage direction from text
      remainingText = remainingText.replace(stageMatches[0], '').trim();
    }
    
    // Try to extract explicit character dialogue with speaker prefixes
    // Look for patterns like "Character Name: Their dialogue" or "Character Name\nTheir dialogue"
    const dialoguePattern = new RegExp(`(${allCharacters.join('|')})\\s*:?\\s*([\\s\\S]+)`, 'i');
    const dialogueMatch = remainingText.match(dialoguePattern);
    
    if (dialogueMatch) {
      // We found an explicit speaker attribution
      result.push({
        type: 'dialogue',
        speaker: allCharacters.find(c => c.toLowerCase() === dialogueMatch[1].toLowerCase()) || dialogueMatch[1],
        text: dialogueMatch[2].trim()
      });
    } else if (remainingText.trim().length > 0) {
      // No explicit speaker found - use the suggested speaker from context
      console.log(`🔍 No explicit speaker found, using suggested speaker: ${suggestedSpeaker}`);
      result.push({
        type: 'dialogue',
        speaker: suggestedSpeaker,
        text: remainingText.trim()
      });
    }
    
    // Validation step - if we have no valid results, add fallbacks
    if (result.length === 0 || !result.some(r => r.type === 'dialogue')) {
      // Ensure we have at least a basic response
      if (!result.some(r => r.type === 'stage')) {
        result.push({
          type: 'stage',
          description: `Detective ${gameState.detectiveName || 'Morris'} continues the investigation.`
        });
      }
      
      result.push({
        type: 'dialogue',
        speaker: suggestedSpeaker,
        text: "I'm listening. What else would you like to know?"
      });
    }
  }
  
  // Validation: ensure the speaker matches expected conversation state
  if (result.some(r => r.type === 'dialogue')) {
    const dialogueObj = result.find(r => r.type === 'dialogue');
    
    // If conversation has a specific character context, validate speaker
    if (gameState.conversation && 
        gameState.conversation.character && 
        gameState.pendingAction !== 'ASK_NAVARRO' &&
        dialogueObj.speaker !== gameState.conversation.character && 
        dialogueObj.speaker !== 'Navarro') {
      
      console.log(`⚠️ Speaker mismatch! Expected ${gameState.conversation.character}, got ${dialogueObj.speaker}. Fixing.`);
      dialogueObj.speaker = gameState.conversation.character;
    }
    
    // If pending action indicates Navarro should speak, enforce that
    if (gameState.pendingAction === 'ASK_NAVARRO' && dialogueObj.speaker !== 'Navarro') {
      console.log(`⚠️ Speaker mismatch! Expected Navarro for ASK_NAVARRO action, got ${dialogueObj.speaker}. Fixing.`);
      dialogueObj.speaker = 'Navarro';
    }
  }
  
  console.log('🧩 Final processed response objects:', result);
  
  // Convert to expected format
  const outputLines = result.map(obj => JSON.stringify(obj)).join('\n');
  res.json({ text: outputLines });

} catch (err) {
  console.error('❌ OpenAI error:', err);
  
  // Provide a graceful fallback that matches expected format
  const fallback = [
    JSON.stringify({ 
      type: 'stage', 
      description: `Detective ${gameState.detectiveName || 'Morris'} continues the investigation.` 
    }),
    JSON.stringify({ 
      type: 'dialogue', 
      speaker: suggestedSpeaker || 'Navarro', 
      text: `There seems to be a communication issue. Let's try a different approach.` 
    })
  ].join('\n');
  
  res.status(200).json({ text: fallback });
}
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server listening on port ${PORT}`);
});