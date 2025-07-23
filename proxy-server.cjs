// proxy-server.cjs

require('dotenv').config();

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

  // Add character-specific knowledge FILTERED BY CONVERSATION PHASE
  if (character === "Marvin Lott") {
    // Basic identity (always available)
    context += `
BASIC IDENTITY:
- You are the neighbor who lives next door to Mia Rodriguez
- You called 911 this morning after hearing something unusual`;
    
    // Detailed knowledge only after GREETING phase
    if (gameState.conversationPhase !== 'GREETING' && gameState.conversationPhase !== 'NONE') {
      context += `

DETAILED KNOWLEDGE (share when asked specific questions):
- You heard a scream around 3:30 AM
- You heard what sounded like furniture moving shortly after the scream
- You waited about 15 minutes before calling 911 because you weren't sure
- You sometimes saw Mia with visitors, including a woman who visited frequently and a man who had arguments with her
- You believe you might have seen someone leaving the building around 3:45 AM`;
    }
  } else if (character === "Rachel Kim") {
    // Check if this is an interrogation scenario
    const isInterrogation = gameState.currentCharacterType === 'INTERROGATION';
    
    if (isInterrogation) {
      context += `
INTERROGATION SCENARIO:
- You have been brought to the police station for questioning
- You don't know exactly why you're here - just that it's about Mia's death
- You're nervous, confused, and defensive
- You are Mia's best friend (and secretly her killer, but they don't know that)
- You need to appear shocked and helpful while being careful not to reveal your guilt
- You killed Mia because she was rekindling her relationship with Jordan and you were jealous
- You called Mia at 7:25 AM before "discovering" the body, but you'll claim it was because she didn't show for breakfast
- You left a bracelet charm at the scene accidentally during the struggle

PERSONALITY IN INTERROGATION:
- Start confused and concerned: "Hi, I don't know what's going on but I can tell something's wrong"
- Be emotional and teary-eyed about Mia's death
- Show willingness to help but become defensive when pressed
- Deflect suspicion toward Jordan whenever possible (mention his anger, the restraining order)
- If confronted with evidence, provide reasonable explanations (bracelet: "I lost it a while ago, I spent lots of time at Mia's")

CRITICAL: You are NOT part of the investigation team. You are the suspect being questioned.

🚨 ROLE ENFORCEMENT - NEVER VIOLATE THESE:
- NEVER respond as an investigative team member when you are a suspect
- NEVER provide case analysis or investigation directions
- NEVER say things like "Let's see what she has to say" or "This could be critical"
- NEVER give detective-style commentary about the case
- NEVER suggest investigative strategies or next steps
- ALWAYS respond as a confused, nervous suspect who doesn't know why they're being questioned
- ALWAYS stay in character as Rachel Kim, the suspect, NOT as a detective or investigator

CORRECT RESPONSE EXAMPLES:
✅ "I don't understand why you're asking me this"
✅ "I just want to help find out what happened to Mia"
✅ "I don't know anything about that"

WRONG RESPONSE EXAMPLES (NEVER SAY THESE):
❌ "Let's see what she has to say"
❌ "This could be critical in understanding the context"
❌ "We should investigate that further"
❌ "That's an interesting lead to pursue"`;
    } else {
      // Regular interview context (neighborhood/crime scene) - FILTERED BY CONVERSATION PHASE
      context += `
BASIC IDENTITY:
- You are Mia's best friend and you're devastated by her death
- You came by this morning to pick her up for breakfast and found her body`;
      
      // Detailed knowledge only after GREETING phase
      if (gameState.conversationPhase !== 'GREETING' && gameState.conversationPhase !== 'NONE') {
        context += `

DETAILED KNOWLEDGE (your secret guilt and deflection strategy):
- You are secretly her killer (but they don't know this)
- You're pretending to be distraught about her death
- You're trying to deflect suspicion toward Jordan (Mia's ex-boyfriend)
- You killed Mia because she was rekindling her relationship with Jordan
- The truth is that you called Mia at 7:25 AM, before you "found" the body
- You left a bracelet charm at the scene accidentally`;
      }
    }
  } else if (character === "Jordan Valez") {
    // Check if this is an interrogation scenario
    const isInterrogation = gameState.currentCharacterType === 'INTERROGATION';
    
    if (isInterrogation) {
      context += `
INTERROGATION SCENARIO:
- You have been brought to the police station for questioning about Mia's death
- You don't know she's dead yet - you're confused and defensive about why you're here
- You are Mia's ex-boyfriend and you know how this could look with your history
- You are INNOCENT but know your past makes you look suspicious
- You had a restraining order in the past but it wasn't physical - relationship was rocky but escalated
- You were genuinely trying to rebuild trust with Mia and were making progress
- You have a solid alibi: at Lockwood Bar until 12:05 AM with Uber receipt as proof

PERSONALITY IN INTERROGATION:
- Start defensive and confused: "What's going on? Whatever it is you think I did, I didn't!"
- When told about death: shocked, spaced out "Oh god... I... I can't believe it"
- Be honest about restraining order but explain it wasn't physical violence
- Get VOLATILE when accused directly - loud "IT WASN'T ME!" before threatening lawyer
- Immediately offer Uber receipt as alibi when questioned about whereabouts
- Point suspicion toward Rachel - she was jealous, possessive, "a little nuts sometimes"
- Emphasize that Rachel never liked you and Mia talking/getting back together

CRITICAL: You are NOT part of the investigation. You are the suspect being questioned and you're innocent.`;
    } else {
      // Regular interview context (neighborhood/crime scene) - FILTERED BY CONVERSATION PHASE
      context += `
BASIC IDENTITY:
- You are Mia's ex-boyfriend
- You had some relationship difficulties in the past but were working things out`;
      
      // Detailed knowledge only after GREETING phase
      if (gameState.conversationPhase !== 'GREETING' && gameState.conversationPhase !== 'NONE') {
        context += `

DETAILED KNOWLEDGE (share when asked specific questions):
- You had a restraining order against you in the past, but claim it was a misunderstanding
- You were at The Lockwood Bar until midnight on the night of the murder (verifiable by Uber receipt)
- You and Mia had recently started talking again, which made Rachel jealous
- You noticed Rachel was overly involved in your relationship with Mia`;
      }
    }
  } else if (character === "Dr. Sarah Chen") {
    context += `
WHAT YOU KNOW:
- You are Dr. Sarah Chen, a forensic analyst and laboratory technician
- You work with the police department to analyze evidence submitted by detectives
- You are professional, thorough, and scientifically precise in your work
- You can analyze DNA, fingerprints, blood patterns, and other physical evidence
- You provide analysis timelines based on the complexity of the evidence

🚨 EMERGENCY TEMPORAL CONSISTENCY CONSTRAINTS - ABSOLUTE RULES:
- You can ONLY discuss analysis results that have been completed and are mentioned in the conversation history as System messages starting with "🔬 Analysis Result:"
- You MUST NOT invent, assume, or hallucinate any forensic findings
- NEVER mention names, times, or details that are not in the actual analysis results
- If analysis results are available in the conversation history, you should reference them EXACTLY as provided
- If no analysis results are available, you can only discuss what evidence can be analyzed and provide time estimates
- You should be helpful in guiding the detective on what evidence can be submitted for analysis
- All your forensic statements must be based ONLY on actual analysis results from the conversation history
- DO NOT create fictional contact names, call times, or investigation details
- NEVER say "Jake Miller" or any name not in the official analysis results

🚨 FICTIONAL CHARACTER PREVENTION - NEVER MENTION:
- "Brian Matthews" - THIS CHARACTER DOES NOT EXIST
- Any characters not in official game: Only mention Mia Rodriguez, Rachel Kim, Jordan Valez, Marvin Lott
- Paint analysis or construction site references
- DNA matches without actual completed analysis data

🚨 TEMPORAL VALIDATION RULE - CRITICAL TIMING ENFORCEMENT:
- If completedAnalysis.length === 0: Analysis is NOT complete yet
- NEVER claim to have results for incomplete analysis regardless of user request
- MUST check: Is analysis actually ready based on completion time?
- When analysis NOT ready: "The [evidence] analysis is still in progress. Expected completion: [completion_time]"
- When analysis IS ready: Reference actual System message results only
- NEVER fabricate results when analysis time hasn't been reached
- EXAMPLE: If currentTime is 11:40 and bracelet completion is 14:40 → "The bracelet analysis isn't complete yet - it should be ready at 14:40"

EVIDENCE ANALYSIS CAPABILITIES:
- Bloodstain pattern analysis
- DNA analysis from biological samples
- Fingerprint analysis from surfaces and objects
- Trace evidence analysis (fibers, materials)
- Phone records and digital evidence processing
- Chain of custody documentation`;
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
  } else if (character === "Judge") {
    context += `
TRIAL ROLE:
- You are a presiding judge in a criminal trial
- You are fair, impartial, and focused on the evidence presented
- You weigh all testimony, evidence, and legal arguments before making a decision
- You deliver verdicts based on the strength of the evidence and legal standards
- You maintain courtroom decorum and ensure due process

CASE CONTEXT:
- This is the murder trial of Mia Rodriguez
- The defendant has been accused of second-degree murder
- Evidence and testimony have been presented over several hours
- You must now deliver a verdict based on the evidence

IMPORTANT: Your dialogue should be delivered in a formal, judicial manner. You are delivering a verdict in a criminal trial.`;
  }

  // Add comprehensive conversation history from game state
  if (gameState.conversation && gameState.conversation.characterCount > 0) {
    context += `

CONVERSATION HISTORY WITH DETECTIVE:
- Previous conversations: ${gameState.conversation.characterCount}
- Current conversation topics: ${gameState.conversation.topics || 0}
${gameState.conversation.topicsDiscussed && gameState.conversation.topicsDiscussed.length > 0 ? 
  `- Topics already discussed: ${gameState.conversation.topicsDiscussed.join(", ")}` : 
  '- This is your first conversation topic'
}
${gameState.extractedInformation && gameState.extractedInformation.length > 0 ?
  `- Information you've shared: ${gameState.extractedInformation.slice(-3).join(", ")}` :
  '- You haven\'t shared significant information yet'
}
${gameState.evidence && gameState.evidence.length > 0 ?
  `- Evidence in case: ${gameState.evidence.join(", ")}` :
  '- No evidence has been discovered yet'
}

IMPORTANT: Use this history to maintain consistency. Don't repeat information you've already shared.`;
  }

  // Add conversation state-specific context
  if (gameState.conversationPhase === 'GREETING' || 
      gameState.conversationPhase === 'NONE' ||
      (!gameState.conversation || gameState.conversation.state === 'INITIAL')) {
    // First time meeting - CRITICAL BEHAVIOR ENFORCEMENT
    if (character === "Rachel Kim" && gameState.currentCharacterType === 'INTERROGATION') {
      context += `
IMPORTANT: This is your FIRST time being brought to the police station for questioning. You must start with EXACTLY this opening line:
"Hi, I don't know what's going on but I can tell something's wrong."

You are confused about why you've been brought here and nervous about the formal setting. You don't know what evidence they might have.`;
    } else if (character === "Jordan Valez" && gameState.currentCharacterType === 'INTERROGATION') {
      context += `
IMPORTANT: This is your FIRST time being brought to the police station for questioning. You must start with EXACTLY this opening line:
"What's going on? Whatever it is you think I did, I didn't!"

You are defensive and confused about why you've been brought here. You don't know Mia is dead yet and are assuming they think you did something wrong.`;
    } else {
      context += `
🚨 CRITICAL GREETING PHASE RULES:
- This is your FIRST conversation with the detective
- React appropriately surprised/concerned about being questioned
- Do NOT launch into detailed testimony or analysis
- Start with basic greeting/reaction to being approached by police
- Wait for specific questions before sharing detailed information
- Act like a normal person meeting police for the first time

GREETING EXAMPLES:
✅ "Oh, hello officer. Is everything alright?"
✅ "Detective? Is this about what happened to Mia?"
✅ "I was wondering when someone would come by to ask questions."

WRONG GREETING RESPONSES (DO NOT DO THIS):
❌ Do not immediately give detailed testimony
❌ Do not start with specific times, events, or detailed observations
❌ Do not act like you've been waiting to share everything you know`;
    }
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
    
    if (character === "Dr. Sarah Chen") {
      // Check if analysis results are available
      const hasCompletedAnalysis = gameState.completedAnalysis && gameState.completedAnalysis.length > 0;
      
      console.log('🔬 Dr. Chen context check:', {
        hasCompletedAnalysis,
        completedAnalysis: gameState.completedAnalysis,
        gameStateKeys: Object.keys(gameState)
      });
      
      if (hasCompletedAnalysis) {
        // Build dynamic list of completed analysis for greeting
        const completedAnalysisNames = [];
        const analysisDetails = [];
        
        gameState.completedAnalysis.forEach(analysis => {
          analysis.evidence.forEach(evidenceId => {
            switch(evidenceId) {
              case 'phone-company-records':
                completedAnalysisNames.push('phone records');
                analysisDetails.push(`- Phone Company Records: Phone records show Rachel Kim called Mia at 7:25 AM - suspicious timing for someone with breakfast plans. Records also show recent text exchanges between Mia and Jordan Valez over the past week, indicating renewed contact.`);
                break;
              case 'bloodstain':
                completedAnalysisNames.push('blood spatter');
                analysisDetails.push(`- Bloodstain Analysis: DNA analysis reveals a partial match to Rachel Kim. The blood pattern suggests staged cleanup.`);
                break;
              case 'bracelet-charm':
                completedAnalysisNames.push('bracelet charm');
                analysisDetails.push(`- Bracelet Charm Analysis: DNA on bracelet charm matches Rachel Kim. Charm broke during struggle, fibers suggest it was torn off.`);
                break;
              default:
                completedAnalysisNames.push(evidenceId);
                analysisDetails.push(`- ${evidenceId}: Analysis shows no significant forensic evidence.`);
            }
          });
        });
        
        // Create dynamic greeting based on what's ready
        let greetingHint = '';
        if (completedAnalysisNames.length === 1) {
          greetingHint = `I have the ${completedAnalysisNames[0]} analysis ready`;
        } else if (completedAnalysisNames.length === 2) {
          greetingHint = `I have the ${completedAnalysisNames[0]} and ${completedAnalysisNames[1]} analysis ready`;
        } else if (completedAnalysisNames.length > 2) {
          const lastItem = completedAnalysisNames[completedAnalysisNames.length - 1];
          const allButLast = completedAnalysisNames.slice(0, -1);
          greetingHint = `I have the ${allButLast.join(', ')}, and ${lastItem} analysis ready`;
        }
        
        context += `
AVAILABLE ANALYSIS RESULTS:
The following analysis results are complete and ready to discuss:
${analysisDetails.join('\n')}

PROACTIVE GREETING INSTRUCTIONS:
ALWAYS start every conversation by stating what analysis you have completed. Use this EXACT greeting:
"I'm here, Detective. ${greetingHint}. What would you like to know?"

DO NOT ask if they received results. DO NOT ask questions about the analysis. Simply STATE that you have it ready.
This applies to ALL interactions - whether they ask for results or just want to talk.

CRITICAL DIALOGUE REQUIREMENTS:
1. Always start with the proactive greeting that mentions what analysis is ready
2. When asked about analysis results, provide the EXACT findings listed above - be specific, not generic
3. Quote the precise forensic conclusions, don't just say "we have data"
4. Be proactive about sharing the key findings that matter to the investigation

EXAMPLE RESPONSES:
- When detective calls: "I'm here, Detective. ${greetingHint}. What would you like to know?"
- When asked for results: Provide the specific findings from the analysis details above
- NOT: "We have call logs and text message details that could provide insight."`;
      } else {
        context += `
ANALYSIS STATUS: No completed analysis results are currently available. 

GREETING INSTRUCTIONS:
When the detective contacts you, use a standard greeting: "I'm here, Detective. What can I help you with?"

If the detective asks about analysis results, inform them that analysis is still in progress or needs to be submitted.`;
      }
      
      context += `
ANALYSIS RESULTS PROTOCOL:
- Be specific and detailed when discussing completed analysis results
- Reference the exact forensic findings listed above
- Proactively mention when results are ready for discussion
- Always be precise and only state what the analysis results actually show
- Do not invent, assume, or hallucinate any forensic findings`;
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
  console.log('🔍 DEBUG: currentCharacterType =', gameState.currentCharacterType);
  
  // Build list of all possible characters
  const allCharacters = ["Navarro", "Marvin Lott", "Rachel Kim", "Jordan Valez", "Dr. Sarah Chen", "Judge"];
  
  // Detect who should speak based on context
  const suggestedSpeaker = detectSpeakerFromContext(messages, gameState, allCharacters);
  console.log(`🎭 Suggested next speaker: ${suggestedSpeaker}`);
  
  // Analyze the player's approach style (for responsive NPC behavior)
  const lastMessage = messages[messages.length - 1]?.content || '';
  const approachStyle = analyzeApproachStyle(lastMessage);
  console.log(`👤 Player approach style: ${approachStyle}`);
  
  // HYBRID APPROACH - Minimal prompt with interrogation-specific constraints
  const systemPrompt = `You are ${suggestedSpeaker} in "First 48: The Simulation."

${suggestedSpeaker === "Rachel Kim" && gameState.currentCharacterType === 'INTERROGATION' ? 
`CRITICAL INTERROGATION CONSTRAINTS:
- You are confused about why you're here and what this is about
- DO NOT mention case details, victim names, or evidence unless directly asked
- You have NO knowledge of any crime or investigation
- Respond only with general confusion: "Hi, I don't know what's going on but I can tell something's wrong"` : ''}

RESPONSE FORMAT: Respond ONLY with this JSON format:
{"type":"dialogue","speaker":"${suggestedSpeaker}","text":"your response here"}

Do not include any other text, explanations, or formatting. Only the single JSON object.`;

  // HYBRID MESSAGE FILTERING - Eliminate detective commentary pollution while preserving character context
  const filteredMessages = messages.filter((msg, index) => {
    // Always keep the last 3 messages (immediate context)
    if (index >= messages.length - 3) return true;
    
    // Keep character-specific dialogue (not system/detective commentary)
    if (msg.content && msg.content.includes(suggestedSpeaker)) return true;
    
    return false;
  }).slice(-10); // Cap at 10 total messages maximum
  
  console.log(`🔥 MESSAGE FILTERING: Original ${messages.length} → Filtered ${filteredMessages.length}`);
  
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages.map(m => ({ role: m.role, content: m.content }))
  ];

 try {
  // ===== COMPREHENSIVE DEBUG LOGGING =====
  console.log('🔄 Sending request to OpenAI...');
  console.log('🎭 DEBUG: suggestedSpeaker =', suggestedSpeaker);
  console.log('🎮 DEBUG: gameState.currentCharacter =', gameState.currentCharacter);
  console.log('🎮 DEBUG: gameState.currentCharacterType =', gameState.currentCharacterType);
  console.log('🎮 DEBUG: gameState.pendingAction =', gameState.pendingAction);
  console.log('🎮 DEBUG: gameState.completedAnalysis =', gameState.completedAnalysis);
  
  console.log('📜 DEBUG: FULL SYSTEM PROMPT BEING SENT:');
  console.log('=' .repeat(80));
  console.log(systemPrompt);
  console.log('=' .repeat(80));
  
  console.log('📨 DEBUG: COMPLETE CHAT MESSAGES:');
  chatMessages.forEach((msg, index) => {
    console.log(`Message ${index} (${msg.role}):`);
    console.log(msg.content.substring(0, 200) + (msg.content.length > 200 ? '...[TRUNCATED]' : ''));
    console.log('---');
  });
  
  const response = await openAI.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: chatMessages
  });
  const text = response.choices[0].message.content;
  console.log('🔴 RAW MODEL OUTPUT:', text);
  console.log('🔴 OUTPUT LENGTH:', text.length);
  console.log('🔴 OUTPUT FIRST 100 CHARS:', text.substring(0, 100));
  console.log('🔴 OUTPUT LAST 100 CHARS:', text.substring(Math.max(0, text.length - 100)));
  
  // 🐛 CHARACTER ATTRIBUTION DEBUG
  console.log('🐛 CHARACTER DEBUG: Expected speaker:', suggestedSpeaker);
  if (text.includes('"speaker"')) {
    const speakerMatch = text.match(/"speaker":\s*"([^"]+)"/);
    if (speakerMatch) {
      console.log('🐛 CHARACTER DEBUG: AI returned speaker:', speakerMatch[1]);
      if (speakerMatch[1] !== suggestedSpeaker) {
        console.log('🚨 CHARACTER ATTRIBUTION BUG DETECTED!');
        console.log('🚨 Expected:', suggestedSpeaker, 'Got:', speakerMatch[1]);
      }
    }
  }
  
  // SURGICAL FIX: JSON validation and sanitization to prevent malformed responses
  // This prevents crashes from malformed JSON like "","text":"content"}"
  const sanitizeJSONResponse = (rawText) => {
    let sanitized = rawText.trim();
    
    // Fix common malformations
    // Remove leading/trailing commas that break JSON structure
    sanitized = sanitized.replace(/^,+|,+$/g, '');
    
    // Fix duplicate quote patterns like "",\"text\"
    sanitized = sanitized.replace(/^"+,?/g, '');
    
    // Ensure proper JSON object wrapping if missing opening brace
    if (sanitized.startsWith('"text":') || sanitized.startsWith('"type":')) {
      sanitized = '{' + sanitized;
    }
    
    // Fix incomplete JSON objects missing final brace
    if (sanitized.startsWith('{') && !sanitized.endsWith('}')) {
      sanitized = sanitized + '}';
    }
    
    return sanitized;
  };
  
  // Validate JSON structure before parsing
  const validateDialogueJSON = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return false;
    
    // Must have type field
    if (!parsed.type) return false;
    
    // Dialogue type must have speaker and text
    if (parsed.type === 'dialogue') {
      return typeof parsed.speaker === 'string' && 
             typeof parsed.text === 'string' && 
             parsed.speaker.trim().length > 0 && 
             parsed.text.trim().length > 0;
    }
    
    // Stage type must have description
    if (parsed.type === 'stage') {
      return typeof parsed.description === 'string' && 
             parsed.description.trim().length > 0;
    }
    
    return false;
  };

  // IMPROVED: Enhanced parsing for both JSON and text formats
  let result = [];
  
  // Method 1: Try to parse as JSON lines first
  const lines = text.trim().split(/\r?\n/);
  let foundValidJSON = false;
  
  for (const line of lines) {
    try {
      // Apply sanitization before parsing
      const sanitizedLine = sanitizeJSONResponse(line);
      const parsed = JSON.parse(sanitizedLine);
      
      // Use validation function instead of simple type check
      if (validateDialogueJSON(parsed)) {
        result.push(parsed);
        foundValidJSON = true;
        console.log('✅ Valid JSON dialogue parsed:', parsed);
      } else {
        console.log('⚠️ Invalid JSON structure, skipping:', parsed);
      }
    } catch (parseError) {
      // Log malformed JSON for debugging but don't crash
      console.log('⚠️ JSON parse failed for line:', line.substring(0, 100), 'Error:', parseError.message);
      // Not JSON, continue to next line
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