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
const openai = new OpenAI({
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
function detectSpeakerFromContext(messages, allCharacters) {
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

// Main route for chat interaction
app.post('/chat', async (req, res) => {
  const { messages, gameState } = req.body;
  
  console.log('💬 Received game state:', gameState);
  console.log('💬 Last message:', messages[messages.length - 1]);
  
  // Build list of all possible characters
  const allCharacters = ["Navarro", "Marvin Lott", "Rachel Kim", "Jordan Valez"];
  
  // Detect who should speak based on context
  const suggestedSpeaker = detectSpeakerFromContext(messages, allCharacters);
  console.log(`🎭 Suggested next speaker: ${suggestedSpeaker}`);
  
  // Analyze the player's approach style (for responsive NPC behavior)
  const lastMessage = messages[messages.length - 1]?.content || '';
  const approachStyle = analyzeApproachStyle(lastMessage);
  console.log(`👤 Player approach style: ${approachStyle}`);
  
  // Get knowledge profile for the suggested speaker
  const speakerKnowledge = characterKnowledge[suggestedSpeaker] || {
    role: "Character",
    personality: { traits: ["neutral"] },
    knowledge: { basic: ["Limited information about the case"] }
  };
  
  // Determine what information this character should reveal based on context
  let relevantKnowledge = "";
  
  if (suggestedSpeaker === "Marvin Lott") {
    relevantKnowledge = `
MARVIN LOTT'S KNOWLEDGE:
Initial Statement:
${speakerKnowledge.knowledge.initialStatement.map(fact => `- ${fact}`).join('\n')}

Follow-up Information (if asked directly):
About the victim:
${speakerKnowledge.knowledge.followUpInfo.aboutVictim.map(fact => `- ${fact}`).join('\n')}

About visitors:
${speakerKnowledge.knowledge.followUpInfo.aboutVisitors.map(fact => `- ${fact}`).join('\n')}

About the night of the murder:
${speakerKnowledge.knowledge.followUpInfo.aboutNight.map(fact => `- ${fact}`).join('\n')}

Hidden information (only if pressed or questioned persistently):
${speakerKnowledge.knowledge.hiddenInfo.map(fact => `- ${fact}`).join('\n')}

Response style: ${approachStyle === 'aggressive' ? 
  'Very nervous, hesitant, might withhold some details due to intimidation' : 
  approachStyle === 'empathetic' ? 
  'Open, forthcoming, provides additional details willingly' : 
  'Moderately helpful but cautious'}
`;
  } else if (suggestedSpeaker === "Rachel Kim") {
    relevantKnowledge = `
RACHEL KIM'S KNOWLEDGE (SHE IS THE KILLER):
Cover Story (what she will claim):
${speakerKnowledge.knowledge.coverStory.map(fact => `- ${fact}`).join('\n')}

Information about Mia:
${speakerKnowledge.knowledge.aboutVictim.map(fact => `- ${fact}`).join('\n')}

Deflections about Jordan:
${speakerKnowledge.knowledge.deflection.map(fact => `- ${fact}`).join('\n')}

Contradictions (DO NOT reveal these directly, but contradict her cover story if pressed):
${speakerKnowledge.knowledge.contradictions.map(fact => `- ${fact}`).join('\n')}

Response style: ${approachStyle === 'aggressive' ? 
  'Defensive, may threaten to call a lawyer, sticks firmly to her story' : 
  approachStyle === 'empathetic' ? 
  'Plays on detective\'s sympathy, appears emotional, works to redirect suspicion to Jordan' : 
  'Outwardly distraught but calculated in her responses'}
`;
  } else if (suggestedSpeaker === "Jordan Valez") {
    relevantKnowledge = `
JORDAN VALEZ'S KNOWLEDGE:
Alibi:
${speakerKnowledge.knowledge.alibi.map(fact => `- ${fact}`).join('\n')}

About his relationship with Mia:
${speakerKnowledge.knowledge.aboutRelationship.map(fact => `- ${fact}`).join('\n')}

Observations about Rachel:
${speakerKnowledge.knowledge.aboutRachel.map(fact => `- ${fact}`).join('\n')}

Exonerating evidence (mention only if directly questioned):
${speakerKnowledge.knowledge.exonerating.map(fact => `- ${fact}`).join('\n')}

Response style: ${approachStyle === 'aggressive' ? 
  'Confrontational, defensive, less cooperative, may demand lawyer' : 
  approachStyle === 'empathetic' ? 
  'Opens up about his history with Mia, shares suspicions about Rachel' : 
  'Initially guarded but straightforward when answering direct questions'}
`;
  } else if (suggestedSpeaker === "Navarro") {
    // For Navarro, factor in the difficulty mode
    const difficultyMode = gameState.mode || "Classic";
    
    relevantKnowledge = `
NAVARRO'S KNOWLEDGE:
Initial observations of the crime scene:
${speakerKnowledge.knowledge.initialObservations.map(fact => `- ${fact}`).join('\n')}

Professional insights (if asked):
${speakerKnowledge.knowledge.professionalInsights.map(fact => `- ${fact}`).join('\n')}

Guidance style (based on ${difficultyMode} difficulty):
${speakerKnowledge.guidance[difficultyMode] ? 
  speakerKnowledge.guidance[difficultyMode].map(tip => `- ${tip}`).join('\n') : 
  '- Provides balanced guidance when asked\n- Lets detective lead the investigation'}
`;
  }

  // Build dynamic system prompt
  const systemPrompt = `
You are the dialogue engine for "First 48: The Simulation," a detective investigation game.
Case: ${caseData.title || "The Murder of Mia Rodriguez"}
Current time: ${gameState.currentTime || 'Unknown'}
Remaining time: ${gameState.timeRemaining || 'Unknown'}
Evidence: ${gameState.evidence?.join(', ') || 'None yet'}
Leads: ${gameState.leads?.join(', ') || 'None yet'}

CRITICAL DIALOGUE PATTERN: For every user input, you MUST respond with this sequence:
1. First, a stage direction: {"type":"stage","description":"<action description>"}
2. Then, a character's dialogue: {"type":"dialogue","speaker":"<Character Name>","text":"<their line>"}

IMPORTANT: Based on the current context, ${suggestedSpeaker} should speak next.
Player's approach style: ${approachStyle} (affecting how characters respond)

${relevantKnowledge}

Character personalities:
- Navarro: Professional detective, world-weary, loyal partner, occasional dry humor
- Marvin Lott: Elderly neighbor, nervous, observant but easily flustered
- Rachel Kim: Mia's best friend, outwardly distraught but calculating, secretly the killer
- Jordan Valez: Ex-boyfriend, emotional, defensive about his past, has solid alibi

Dialogue rules:
1. If the detective is knocking on someone's door or approaching them, THAT PERSON should respond.
2. If the detective asks a direct question to a specific person, THAT PERSON should answer.
3. If the detective is examining a crime scene, Navarro should provide detective commentary.
4. NPCs should speak in their own distinct voice and perspective.
5. Never break character or the fourth wall.
6. Do not reveal that Rachel is the killer directly - she should appear as a grieving friend.

EXAMPLE DIALOGUE PATTERN:
User: "Let's go talk to Marvin Lott"
{"type":"stage","description":"Detective ${gameState.detectiveName || 'Morris'} walks to Marvin Lott's apartment and knocks on the door."}
{"type":"dialogue","speaker":"Marvin Lott","text":"*opening the door slightly* Oh, Detective. I've been waiting for you. Still shaken up about what happened to poor Mia."}

Ensure each JSON object is on its own line with no additional text.
`;

  // Build messages for OpenAI
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    console.log('🔄 Sending request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages
    });
    const text = response.choices[0].message.content;
    console.log('🔴 RAW MODEL OUTPUT:', text);
    
    // Parse the response
    const lines = text.trim().split(/\r?\n/);
    const parsed = lines
      .map(l => { 
        try { 
          return JSON.parse(l); 
        } catch (e) { 
          console.error('❌ Failed to parse line:', l, e); 
          return null; 
        } 
      })
      .filter(o => o !== null);
    
    console.log('🧩 Parsed objects:', parsed);
    
    // Handle case where no valid JSON was returned
    if (parsed.length === 0) {
      console.warn('⚠️ No valid JSON objects found in response');
      
      // Generate a fallback response based on context
      const stageDescription = `Detective ${gameState.detectiveName || 'Morris'} ${
        suggestedSpeaker === "Navarro" 
          ? "looks around the crime scene thoughtfully." 
          : `waits for ${suggestedSpeaker} to respond.`
      }`;
      
      // Generate appropriate dialogue based on character
      let dialogueText;
      if (suggestedSpeaker === "Marvin Lott") {
        dialogueText = "Yes, Detective? I heard the commotion this morning. Terrible thing what happened to Mia. I called the police right after I heard that scream around 3:30 AM.";
      } else if (suggestedSpeaker === "Rachel Kim") {
        dialogueText = "I can't believe this happened to Mia. We were supposed to have breakfast this morning... I was the one who found her. Who would do something like this?";
      } else if (suggestedSpeaker === "Jordan Valez") {
        dialogueText = "Look, I know what you're thinking, but I wasn't anywhere near Mia's place last night. I was at The Lockwood Bar until midnight, then went straight home.";
      } else {
        dialogueText = "What's our next move, Detective? We should be thorough in our investigation.";
      }
      
      const fallback = [
        JSON.stringify({ type: 'stage', description: stageDescription }),
        JSON.stringify({ type: 'dialogue', speaker: suggestedSpeaker, text: dialogueText })
      ].join('\n');
      
      res.json({ text: fallback });
      return;
    }
    
    // Ensure we have a stage direction
    let hasStage = parsed.some(obj => obj.type === 'stage');
    if (!hasStage) {
      const stageObj = JSON.stringify({ 
        type: 'stage', 
        description: `Detective ${gameState.detectiveName || 'Morris'} continues the investigation.` 
      });
      text = stageObj + '\n' + text;
    }
    
    // Ensure we have a dialogue response
    let hasDialogue = parsed.some(obj => obj.type === 'dialogue');
    if (!hasDialogue) {
      const dialogueObj = JSON.stringify({
        type: 'dialogue',
        speaker: suggestedSpeaker,
        text: suggestedSpeaker === "Navarro" 
          ? "What's our next move, Detective?" 
          : "Is there something specific you wanted to ask me?"
      });
      text = text + '\n' + dialogueObj;
    }
    
    // If we have dialogue but wrong speaker, add suggested speaker's response
    const dialogueObjs = parsed.filter(obj => obj.type === 'dialogue');
    const hasSuggestedSpeaker = dialogueObjs.some(obj => obj.speaker === suggestedSpeaker);
    
    if (dialogueObjs.length > 0 && !hasSuggestedSpeaker && suggestedSpeaker !== "Navarro") {
      // The model didn't have the right character speak
      const additionalDialogue = JSON.stringify({
        type: 'dialogue',
        speaker: suggestedSpeaker,
        text: `*appearing at the door* Detective, I heard you wanted to speak with me?`
      });
      text = text + '\n' + additionalDialogue;
    }
    
    res.json({ text });
  } catch (err) {
    console.error('❌ OpenAI error:', err);
    // Provide a graceful fallback
    const fallback = [
      JSON.stringify({ 
        type: 'stage', 
        description: `Detective ${gameState.detectiveName || 'Morris'} continues the investigation.` 
      }),
      JSON.stringify({ 
        type: 'dialogue', 
        speaker: 'Navarro', 
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