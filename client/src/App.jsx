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

// Helper function to get time of day description
function getTimeOfDay(timeInMinutes) {
  const hours = Math.floor(timeInMinutes / 60);
  
  if (hours < 6) {
    return 'night';
  } else if (hours < 12) {
    return 'morning';
  } else if (hours < 17) {
    return 'afternoon';
  } else if (hours < 21) {
    return 'evening';
  } else {
    return 'night';
  }
}

// Helper to generate transition narrative
function generateTransitionNarrative(fromCharacter, toCharacter, action, gameState) {
  // Different narrative types based on the transition
  if (action === 'END_CONVERSATION' && fromCharacter) {
    // Ending a conversation
    const timeOfDay = getTimeOfDay(gameState.currentTime);
    const characterMood = gameState.conversationState?.characters[fromCharacter]?.mood || 'neutral';
    
    const endingPhrases = {
      'defensive': `*${fromCharacter} crosses their arms defensively as you wrap up the conversation.*`,
      'nervous': `*${fromCharacter} fidgets nervously as you conclude your questioning.*`,
      'friendly': `*${fromCharacter} nods understandingly as you prepare to leave.*`,
      'suspicious': `*${fromCharacter} watches you carefully as you step away.*`,
      'neutral': `*You conclude your conversation with ${fromCharacter}.*`
    };
    
    return endingPhrases[characterMood] || endingPhrases.neutral;
  } 
  else if (action === 'MOVE_TO_CHARACTER' && toCharacter) {
    // Moving to a new character - we handle this manually now, so return null
    return null;
  }
  
  return null;
}

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
// Add this conversation debug toolkit to your codebase
const ConversationDebug = {
  // Enable or disable debug logging
  enabled: true,
  
  // Log levels
  levels: {
    INFO: '📝',
    WARN: '⚠️',
    ERROR: '❌',
    STATE: '🔄',
    TOPIC: '🏷️',
    DIALOGUE: '💬',
    TRANSITION: '🚪'
  },
  
  // Main logging function
  log: function(level, message, data = null) {
    if (!this.enabled) return;
    
    const prefix = this.levels[level] || '🔍';
    
    if (data) {
      console.log(`${prefix} [${level}] ${message}`, data);
    } else {
      console.log(`${prefix} [${level}] ${message}`);
    }
  },
  
  // Specialized logging methods
  logState: function(message, state) {
    this.log('STATE', message, state);
  },
  
  logTopicDetection: function(text, topics) {
    this.log('TOPIC', `Detected topics in: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`, topics);
  },
  
  logDialogue: function(speaker, message) {
    this.log('DIALOGUE', `${speaker}: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}""`);
  },
  
  logTransition: function(from, to, action) {
    this.log('TRANSITION', `Scene transition: ${from || 'none'} → ${to || 'none'} (${action})`);
  },
  
  // State validation
  validateStateTransition: function(prevState, newState) {
    // Check for valid phase transitions
    const validTransitions = {
      'NONE': ['GREETING', 'NONE'],
      'GREETING': ['QUESTIONING', 'CONCLUDING', 'NONE'],
      'QUESTIONING': ['QUESTIONING', 'CONCLUDING', 'NONE'],
      'CONCLUDING': ['NONE', 'GREETING']
    };
    
    if (prevState.conversationPhase !== newState.conversationPhase) {
      const isValidTransition = validTransitions[prevState.conversationPhase]?.includes(newState.conversationPhase);
      
      if (!isValidTransition) {
        this.log('WARN', `Invalid phase transition: ${prevState.conversationPhase} → ${newState.conversationPhase}`);
        return false;
      }
    }
    
    // Check for other potential issues
    if (newState.conversationPhase === 'GREETING' && !newState.currentCharacter) {
      this.log('ERROR', 'GREETING phase requires a currentCharacter to be set');
      return false;
    }
    
    if (newState.conversationPhase === 'QUESTIONING' && !newState.currentCharacter) {
      this.log('ERROR', 'QUESTIONING phase requires a currentCharacter to be set');
      return false;
    }
    
    if (newState.conversationPhase === 'NONE' && newState.currentCharacter) {
      this.log('WARN', 'NONE phase should not have a currentCharacter');
    }
    
    return true;
  },
  
  // Topic detection validation
  validateTopicDetection: function(text, detectedTopics) {
    // Check for expected topics based on keywords
    const expectedTopicPatterns = {
      'weapon': ['knife', 'stab', 'weapon'],
      'timing': ['time', 'when', 'hour', 'morning', 'night', 'clock'],
      'alibi': ['where', 'were you', 'doing', 'that night'],
      'victim': ['mia', 'victim', 'rodriguez', 'dead', 'body']
    };
    
    const lowerText = text.toLowerCase();
    
    // Check for missing expected topics
    Object.entries(expectedTopicPatterns).forEach(([topic, keywords]) => {
      if (keywords.some(word => lowerText.includes(word)) && !detectedTopics.includes(topic)) {
        this.log('WARN', `Expected topic "${topic}" not detected in: "${text.substring(0, 40)}..."`, {
          text: text,
          detectedTopics: detectedTopics,
          trigger: keywords.find(word => lowerText.includes(word))
        });
      }
    });
    
    return true;
  },
  
  // Conversation consistency check
  checkConversationConsistency: function(conversationState) {
    // Check if we have proper character states
    if (conversationState.currentCharacter) {
      const characterData = conversationState.characters[conversationState.currentCharacter];
      
      if (!characterData) {
        this.log('ERROR', `Current character "${conversationState.currentCharacter}" has no data in characters object`);
        return false;
      }
      
      if (!characterData.state) {
        this.log('WARN', `Character "${conversationState.currentCharacter}" has no state property`);
      }
      
      if (!characterData.topicsDiscussed) {
        this.log('WARN', `Character "${conversationState.currentCharacter}" has no topicsDiscussed array`);
      }
    }
    
    // Check for orphaned character references
    if (conversationState.conversationPhase !== 'NONE' && !conversationState.currentCharacter) {
      this.log('ERROR', `Conversation phase ${conversationState.conversationPhase} active but no currentCharacter set`);
      return false;
    }
    
    return true;
  },
  
  // Generate debug state summary
  getConversationSummary: function(state) {
    if (!state) return 'No state available';
    
    return {
      phase: state.conversationPhase,
      currentCharacter: state.currentCharacter,
      action: state.pendingAction,
      characterCount: Object.keys(state.characters || {}).length,
      topics: state.globalTopics?.length || 0,
      characters: Object.entries(state.characters || {}).map(([name, data]) => ({
        name,
        state: data.state,
        topicCount: data.topicsDiscussed?.length || 0,
        visitCount: data.visitCount || 0,
        mood: data.mood
      }))
    };
  }
};

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
  conversationPhase: 'NONE', // 'NONE', 'GREETING', 'QUESTIONING', 'CONCLUDING'
  pendingAction: null,
  lastResponseTime: null,
  globalTopics: [], // Add this line
  characters: {
    // Per-character state will be populated dynamically:
    // 'Character Name': {
    //   state: 'INITIAL' | 'RETURNING',
    //   topicsDiscussed: ['topic1', 'topic2', ...],
    //   relationshipLevel: 0, // Increases with meaningful interactions
    //   lastInteractionTime: null, // In-game time of last conversation
    //   keyInformationShared: [], // Important case facts they've shared
    //   suspicionLevel: 0, // How suspicious they seem (0-10)
    //   mood: 'neutral' // neutral, friendly, defensive, suspicious, etc.
    // }
  }
});  
const currentClock = () => START_OF_DAY + timeElapsed;


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

  // Typewriter effect state
  const [typewriterQueue, setTypewriterQueue] = useState([]);
  const [currentlyTyping, setCurrentlyTyping] = useState(null);
  const [displayedMsgs, setDisplayedMsgs] = useState([]);
  const typewriterTimerRef = useRef(null);

   // Create an enhanced conversation state setter with validation
  function setConversationStateWithValidation(updater) {
    setConversationState(prevState => {
      // Call the original updater to get the new state
      const newState = updater(prevState);
      
      // Enhanced validation for state consistency
      if (newState.currentCharacter && newState.conversationPhase === 'NONE') {
        console.warn('⚠️ State inconsistency: currentCharacter set but conversationPhase is NONE');
        // Fix automatically
        newState.conversationPhase = 'GREETING';
      }
      
      if (!newState.currentCharacter && newState.conversationPhase !== 'NONE') {
        console.warn('⚠️ State inconsistency: conversationPhase active but no currentCharacter');
        // Fix automatically
        newState.conversationPhase = 'NONE';
        newState.pendingAction = null;
      }
      
      // Validate the state transition
      ConversationDebug.validateStateTransition(prevState, newState);
      
      // Check conversation consistency
      ConversationDebug.checkConversationConsistency(newState);
      
      // Log state change
      ConversationDebug.logState("Conversation state updated", 
        ConversationDebug.getConversationSummary(newState)
      );
      
      // Return the new state
      return newState;
    });
  }

// Add this function to handle character state updates
function updateCharacterState(characterName, updates, setState) {
  setState(prevState => {
    // Get existing character data or initialize if this is first interaction
    const existingCharacterData = 
      prevState.characters[characterName] || 
      {
        state: 'INITIAL',
        topicsDiscussed: [],
        relationshipLevel: 0,
        lastInteractionTime: null,
        keyInformationShared: [],
        suspicionLevel: 0,
        mood: 'neutral',
        visitCount: 0
      };
    
    // Create updated character data by merging existing with updates
    const updatedCharacterData = {
      ...existingCharacterData,
      ...updates,
      // Always increment visit count when explicitly updating character state
      visitCount: updates.visitCount !== undefined ? 
        updates.visitCount : 
        (existingCharacterData.visitCount + (updates.state === 'RETURNING' ? 1 : 0))
    };
    
    console.log(`🔄 Updating character state for ${characterName}:`, updatedCharacterData);
    
    // Return updated conversation state
    return {
      ...prevState,
      characters: {
        ...prevState.characters,
        [characterName]: updatedCharacterData
      }
    };
  });
}

// Add this function to track topic discussion
function recordTopicDiscussion(character, topics, setState) {
  if (!character || !topics || topics.length === 0) return;
  
  setState(prevState => {
    const existingCharacter = prevState.characters[character] || { 
      topicsDiscussed: [],
      state: 'INITIAL'
    };
    
    // Add only new topics (that haven't been discussed before)
    const newTopics = topics.filter(
      topic => !existingCharacter.topicsDiscussed.includes(topic)
    );
    
    if (newTopics.length === 0) return prevState; // No new topics to add
    
    console.log(`📝 Recording new topics for ${character}:`, newTopics);
    
    // Return updated state with new topics added
    return {
      ...prevState,
      characters: {
        ...prevState.characters,
        [character]: {
          ...existingCharacter,
          topicsDiscussed: [...existingCharacter.topicsDiscussed, ...newTopics]
        }
      }
    };
  });
}

// Add this function to sanitize data for API requests
function sanitizeForJSON(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Remove or replace problematic Unicode characters
    return obj
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
      .replace(/[\u{200D}]/gu, '')            // Zero Width Joiner
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForJSON(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeForJSON(key)] = sanitizeForJSON(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Add this function to check if a topic has been discussed with a character
function hasDiscussedTopic(character, topic, conversationState) {
  if (!character || !topic) return false;
  
  const characterData = conversationState.characters[character];
  if (!characterData || !characterData.topicsDiscussed) return false;
  
  return characterData.topicsDiscussed.includes(topic);
}

// Add this function to get character mood description
function getCharacterMood(character, conversationState) {
  if (!character) return 'neutral';
  
  const characterData = conversationState.characters[character];
  if (!characterData || !characterData.mood) return 'neutral';
  
  return characterData.mood;
}

// Add this function to update character mood based on interaction
function updateCharacterMood(character, interaction, setState) {
  if (!character) return;
  
  setState(prevState => {
    const existingCharacter = prevState.characters[character] || { 
      mood: 'neutral',
      suspicionLevel: 0
    };
    
    // Determine mood change based on interaction type
    let moodChange = 'neutral';
    let suspicionChange = 0;
    
    switch (interaction) {
      case 'accusatory':
        moodChange = 'defensive';
        suspicionChange = 1;
        break;
      case 'friendly':
        moodChange = 'friendly';
        suspicionChange = -1;
        break;
      case 'suspicious':
        moodChange = 'nervous';
        suspicionChange = 2;
        break;
      case 'empathetic':
        moodChange = 'open';
        suspicionChange = -2;
        break;
      case 'professional':
        moodChange = 'neutral';
        break;
      default:
        // No change
        return prevState;
    }
    
    // Calculate new suspicion level (clamped between 0-10)
    const newSuspicionLevel = Math.max(0, Math.min(10, 
      existingCharacter.suspicionLevel + suspicionChange
    ));
    
    console.log(`😊 Updating ${character}'s mood to ${moodChange}, suspicion: ${newSuspicionLevel}`);
    
    // Return updated state with new mood
    return {
      ...prevState,
      characters: {
        ...prevState.characters,
        [character]: {
          ...existingCharacter,
          mood: moodChange,
          suspicionLevel: newSuspicionLevel
        }
      }
    };
  });
}
// Enhanced conversation ending detection
// Enhanced conversation ending detection - update your existing isEndingConversation function
const isEndingConversation = useCallback((text, currentState) => {
  // If we're not in a conversation, we can't end one
  if (!currentState.currentCharacter) return false;

  const lowerText = text.toLowerCase();
  
  // Comprehensive list of goodbye phrases
  const goodbyePhrases = [
    'goodbye', 'bye', 'see you', 'thanks', 'thank you', 'later',
    'that will be all', 'that is all', 'that\'s all', 'that\'s it',
    'if we need', 'we will find you', 'find you later', 'catch you later',
    'contact you', 'that helps', 'let\'s go', 'let\'s leave', 'appreciate it',
    'i should go', 'need to go', 'moving on', 'leave now', 'gotta go',
    'go back', 'return to', 'head back', 'enough for now', 'that should do it',
    'wrap this up', 'done here', 'finished here', 'all set', 'all done'
  ];
  
  // Movement phrases that indicate leaving
  const movementPhrases = [
    'go back to', 'return to', 'leave', 'exit', 'head to',
    'go to the', 'check out', 'investigate', 'examine', 'visit',
    'look at', 'search', 'head over to', 'check on', 'move to'
  ];
  
  // Location references that indicate movement away
  const locationReferences = [
    'crime scene', 'apartment', 'station', 'lab', 'office', 
    'hallway', 'bathroom', 'kitchen', 'bedroom', 'building'
  ];
  
  // Transition to investigation phrases
  const investigationPhrases = [
    'let me check', 'i need to investigate', 'i should examine', 
    'i want to look at', 'need to process', 'collect evidence',
    'take a sample', 'photograph', 'document', 'analyze'
  ];
  
  // Character comparison helper - are we redirecting to another character?
  const otherCharacterMentioned = Object.keys(currentState.characters || {})
    .filter(char => char !== currentState.currentCharacter)
    .some(char => {
      const lowerChar = char.toLowerCase();
      return lowerText.includes(lowerChar) && 
             (lowerText.includes('talk to') || 
              lowerText.includes('ask') || 
              lowerText.includes('interview') ||
              lowerText.includes('speak with'));
    });
  
  // Context-based ending signals
  const contextualEndingPatterns = [
    // Phrase that implies you've gotten what you need - make more specific
    { pattern: 'that\'s helpful', context: 'ANY' },
    { pattern: 'that helps', context: 'ANY' },
    // Don't match "helps" in "everything helps" - add word boundary check
    { pattern: 'very helpful', context: 'ANY' },
    // Longer pauses might indicate conversation transitions
    { pattern: '...', context: 'QUESTIONING' },
    // If asking about evidence while talking to someone
    { pattern: 'evidence', context: 'QUESTIONING' },
    // After several exchanges, brief responses can signal ending
    { pattern: '.', context: 'QUESTIONING', 
      condition: () => currentState.characters[currentState.currentCharacter]?.visitCount > 2 && 
                       lowerText.split(' ').length < 4 }
  ];
  
  // Check for explicit goodbyes
  const isGoodbye = goodbyePhrases.some(phrase => lowerText.includes(phrase));
  
  // Check for movement away from the conversation
  const isMovingAway = (movementPhrases.some(phrase => lowerText.includes(phrase)) &&
                        locationReferences.some(location => lowerText.includes(location)) &&
                        !lowerText.includes(currentState.currentCharacter.toLowerCase()));
  
  // Check for transition to investigation
  const isTransitioningToInvestigation = investigationPhrases.some(phrase => 
    lowerText.includes(phrase)
  );
  
  // Check for questions directed to another person (like Navarro)
  const isRedirectingConversation = lowerText.includes('navarro') || 
                                   (lowerText.includes('what do you think') && 
                                   !lowerText.includes(currentState.currentCharacter.toLowerCase()));
  
  // Check for contextual ending patterns - simplified to avoid issues
  const hasContextualEnding = contextualEndingPatterns.some(pattern => {
    // Skip problematic patterns for now
    if (pattern.pattern === 'that\'s helpful' || pattern.pattern === 'that helps') {
      return false;
    }
    
    return lowerText.includes(pattern.pattern) && 
           (pattern.context === 'ANY' || pattern.context === currentState.conversationPhase) &&
           (!pattern.condition || pattern.condition());
  });
  
  // Assess conversation fatigue - has this gone on for too long?
  const conversationLength = currentState.characters[currentState.currentCharacter]?.lastDialogue?.timestamp
    ? (currentClock() - currentState.characters[currentState.currentCharacter].lastDialogue.timestamp)
    : 0;
    
  const hasConversationFatigue = conversationLength > 15; // If more than 15 minutes in-game time
  
  // New: Check if conversation feels complete based on topics
  const relevantTopics = ['alibi', 'motive', 'witness', 'timing', 'weapon', 'relationships'];
  const discussedImportantTopics = currentState.characters[currentState.currentCharacter]?.topicsDiscussed || [];
  const hasDiscussedCriticalTopics = relevantTopics.every(topic => 
    discussedImportantTopics.includes(topic)
  );
  
  // Overall ending assessment
  const isEnding = isGoodbye || 
                  isMovingAway || 
                  isRedirectingConversation || 
                  isTransitioningToInvestigation ||
                  otherCharacterMentioned ||
                  hasContextualEnding ||
                  (hasConversationFatigue && hasDiscussedCriticalTopics);
  
  
  // Detailed logging for debugging
  console.log('🔍 Checking if ending conversation:', {
    isEnding,
    character: currentState.currentCharacter,
    phase: currentState.conversationPhase,
    isGoodbye,
    isMovingAway,
    isRedirectingConversation,
    isTransitioningToInvestigation,
    otherCharacterMentioned,
    hasContextualEnding,
    hasConversationFatigue,
    hasDiscussedCriticalTopics,
    text: text.substring(0, 50) + '...'
  });
  
  // Enhanced debugging - show which condition is triggering
  if (isEnding) {
    console.log('⚠️ ENDING TRIGGERED BY:', {
      isGoodbye: isGoodbye,
      isMovingAway: isMovingAway,
      isRedirectingConversation: isRedirectingConversation,
      isTransitioningToInvestigation: isTransitioningToInvestigation,
      otherCharacterMentioned: otherCharacterMentioned,
      hasContextualEnding: hasContextualEnding,
      conversationFatigue: hasConversationFatigue && hasDiscussedCriticalTopics
    });
  }
  
  return isEnding;
  }, [timeElapsed, START_OF_DAY]); 

  // —— TYPEWRITER EFFECT FUNCTIONS ——
  // Skip current typewriter animation and complete it instantly
  const skipTypewriter = useCallback(() => {
    if (currentlyTyping) {
      // Clear any pending timeout
      if (typewriterTimerRef.current) {
        clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      
      // Complete the current message instantly
      setDisplayedMsgs(prev => {
        const updated = [...prev];
        const msgIndex = updated.findIndex(m => m.id === currentlyTyping.id);
        if (msgIndex !== -1) {
          updated[msgIndex] = {
            ...updated[msgIndex],
            displayContent: currentlyTyping.content,
            isTyping: false
          };
        }
        return updated;
      });
      
      // Clear current typing state
      setCurrentlyTyping(null);
      
      // Auto-scroll after completion
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [currentlyTyping]);

  // Process typewriter queue and start typing next message
  const processTypewriterQueue = useCallback(() => {
    if (currentlyTyping || typewriterQueue.length === 0) return;
    
    const nextMessage = typewriterQueue[0];
    setCurrentlyTyping(nextMessage);
    setTypewriterQueue(prev => prev.slice(1));
    
    // Start typing animation
    let charIndex = 0;
    const content = nextMessage.content;
    const typingSpeed = 25; // milliseconds per character (faster for gaming experience)
    
    const typeNextChar = () => {
      if (charIndex <= content.length) {
        // Update displayed messages with partial content
        setDisplayedMsgs(prev => {
          const updated = [...prev];
          const msgIndex = updated.findIndex(m => m.id === nextMessage.id);
          if (msgIndex !== -1) {
            updated[msgIndex] = {
              ...updated[msgIndex],
              displayContent: content.substring(0, charIndex),
              isTyping: charIndex < content.length
            };
          }
          return updated;
        });
        
        charIndex++;
        
        if (charIndex <= content.length) {
          typewriterTimerRef.current = setTimeout(typeNextChar, typingSpeed);
        } else {
          // Typing complete
          setCurrentlyTyping(null);
          // Auto-scroll after message is complete
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    };
    
    typeNextChar();
  }, [currentlyTyping, typewriterQueue]);

  // Add new message to typewriter system
  const addMessageWithTypewriter = useCallback((newMessage) => {
    const messageWithId = {
      ...newMessage,
      id: Date.now() + Math.random(), // Unique ID for tracking
      displayContent: '',
      isTyping: false
    };
    
    // Add to displayed messages immediately (but with empty content)
    setDisplayedMsgs(prev => [...prev, messageWithId]);
    
    // Add to typing queue
    setTypewriterQueue(prev => [...prev, messageWithId]);
  }, []);

  // Process typewriter queue when it changes
  useEffect(() => {
    if (typewriterQueue.length > 0 && !currentlyTyping) {
      const timer = setTimeout(processTypewriterQueue, 100);
      return () => clearTimeout(timer);
    }
  }, [typewriterQueue.length, currentlyTyping, processTypewriterQueue]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current) {
        clearTimeout(typewriterTimerRef.current);
      }
    };
  }, []);


  // Sync msgs with typewriter system when msgs changes
  useEffect(() => {
    // Compare msgs with current displayedMsgs to find new messages
    const currentMsgCount = displayedMsgs.length;
    const newMsgCount = msgs.length;
    
    if (newMsgCount > currentMsgCount) {
      // New messages have been added
      const newMessages = msgs.slice(currentMsgCount);
      newMessages.forEach(msg => {
        addMessageWithTypewriter(msg);
      });
    } else if (newMsgCount < currentMsgCount) {
      // Messages were reset (like at game start)
      const msgsWithTypewriter = msgs.map(msg => ({
        ...msg,
        id: Date.now() + Math.random(),
        displayContent: '',
        isTyping: false
      }));
      
      setDisplayedMsgs(msgsWithTypewriter);
      setTypewriterQueue(msgsWithTypewriter);
      setCurrentlyTyping(null);
      
      // Clear any active timer
      if (typewriterTimerRef.current) {
        clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    }
  }, [msgs, addMessageWithTypewriter, displayedMsgs.length]);

  // —— KEYBOARD HANDLERS FOR TYPEWRITER SKIP ——
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle Enter key when not focused on an input field
      if (event.key === 'Enter' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        skipTypewriter();
      }
    };

    // Add global keydown listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [skipTypewriter]);

  // —— NAVARRO TRANSITION AFTER CONVERSATION ENDS ——
  useEffect(() => {
    if (conversationState.conversationPhase === 'CONCLUDING' && conversationState.pendingAction === 'END_CONVERSATION' && !loading) {
      console.log('🔚 FINAL conversation end detected, adding Navarro transition');
      
      const navarroTransitions = [
        "Alright, Detective. That gave us some useful information. What's our next move?",
        "Good work getting that information. Where should we focus our investigation now?",
        "That was helpful. What do you think we should do next?",
        "Okay, we've got some new details to work with. What's your next step?",
        "Nice interview. We're making progress. Where to next?"
      ];
      
      const randomTransition = navarroTransitions[Math.floor(Math.random() * navarroTransitions.length)];
      
      setTimeout(() => {
        console.log('🔚 Adding Navarro transition after conversation end');
        setMsgs(m => [...m, { speaker: 'Navarro', content: randomTransition }]);
        
        // Reset conversation state
        setConversationStateWithValidation(prev => ({
          ...prev,
          currentCharacter: null,
          pendingAction: null,
          conversationPhase: 'NONE'
        }));
      }, 1500); // Even longer delay to ensure all message processing completes
    }
  }, [conversationState.conversationPhase, conversationState.pendingAction, loading]);

  // —— DERIVED NOTES STATE ——
  // Function to update detective thoughts based on game state
  const updateDetectiveThoughts = useCallback(() => {
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
  }, [leads, interviewsCompleted, actionsPerformed, timeElapsed]);

  // Update detective thoughts when relevant state changes
  useEffect(() => {
    updateDetectiveThoughts();
  }, [updateDetectiveThoughts]);
  
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
  const [extractedInformation, setExtractedInformation] = useState({});
  
  // Track actual extracted information from conversations
  useEffect(() => {
    console.log('🔍 Updating notes from leads:', leads);
    const updatedNotes = [];
    
    // Process each active lead and add only actually extracted information
    leads.forEach(leadId => {
      const leadDef = leadDefinitions.find(d => d.id === leadId);
      if (!leadDef || leadDef.isRedHerring) return;
      
      // Check if this is an interview lead and we have extracted info
      if (leadId === 'interview-marvin' && extractedInformation['Marvin Lott']) {
        const marvinInfo = extractedInformation['Marvin Lott'];
        updatedNotes.push(`Marvin Lott (Neighbor): ${marvinInfo.join(', ')}`);
      }
      else if (leadId === 'interview-rachel' && extractedInformation['Rachel Kim']) {
        const rachelInfo = extractedInformation['Rachel Kim'];
        updatedNotes.push(`Rachel Kim (Best Friend): ${rachelInfo.join(', ')}`);
      }
      else if (leadId === 'interview-jordan' && extractedInformation['Jordan Valez']) {
        const jordanInfo = extractedInformation['Jordan Valez'];
        updatedNotes.push(`Jordan Valez (Ex-Boyfriend): ${jordanInfo.join(', ')}`);
      }
      else if (leadId.includes('scene-') || leadId.includes('analysis') || leadId.includes('records')) {
        // For non-interview leads, show the generic description
        updatedNotes.push(leadDef.description);
      }
    });
    
    console.log('📝 Setting notes to:', updatedNotes);
    setNotes(updatedNotes);
  }, [leads, extractedInformation]);

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



  // Helper function to detect character mentions in user input

// Function to extract actual information from character dialogue
function extractInformationFromDialogue(speaker, text) {
  const extracted = [];
  const lowerText = text.toLowerCase();
  
  if (speaker === 'Marvin Lott') {
    // Extract specific information from Marvin's dialogue
    if (lowerText.includes('3:30') || lowerText.includes('scream')) {
      extracted.push('Heard scream around 3:30 AM');
    }
    if (lowerText.includes('called 911') || lowerText.includes('911')) {
      extracted.push('Called 911 after hearing scream');
    }
    if (lowerText.includes('15 minutes') || lowerText.includes('waited')) {
      extracted.push('Waited 15 minutes before calling');
    }
    if (lowerText.includes('furniture') || lowerText.includes('moving')) {
      extracted.push('Heard furniture moving after scream');
    }
    if (lowerText.includes('someone leaving') || lowerText.includes('saw') && lowerText.includes('building')) {
      extracted.push('Saw someone leave building around 3:45-4:00 AM');
    }
    if (lowerText.includes('nervous') || lowerText.includes('shaken')) {
      extracted.push('Appeared nervous during questioning');
    }
    if (lowerText.includes('visitor') || lowerText.includes('woman') || lowerText.includes('man')) {
      extracted.push('Mentioned seeing visitors at victim\'s apartment');
    }
  }
  
  if (speaker === 'Rachel Kim') {
    // Extract information from Rachel's dialogue
    if (lowerText.includes('8:00') || lowerText.includes('breakfast')) {
      extracted.push('Claims found body at 8:00 AM for breakfast');
    }
    if (lowerText.includes('best friend') || lowerText.includes('close')) {
      extracted.push('Claims to be victim\'s best friend');
    }
    if (lowerText.includes('jordan') || lowerText.includes('ex')) {
      extracted.push('Mentioned Jordan (ex-boyfriend)');
    }
    if (lowerText.includes('jealous') || lowerText.includes('angry')) {
      extracted.push('Described someone as jealous/angry');
    }
  }
  
  if (speaker === 'Jordan Valez') {
    // Extract information from Jordan's dialogue
    if (lowerText.includes('lockwood') || lowerText.includes('bar')) {
      extracted.push('Claims was at Lockwood Bar');
    }
    if (lowerText.includes('uber') || lowerText.includes('receipt')) {
      extracted.push('Has Uber receipt as alibi');
    }
    if (lowerText.includes('restraining order') || lowerText.includes('misunderstanding')) {
      extracted.push('Mentioned restraining order was misunderstanding');
    }
    if (lowerText.includes('rachel') && (lowerText.includes('possessive') || lowerText.includes('involved'))) {
      extracted.push('Described Rachel as overly involved');
    }
  }
  
  return extracted;
}

// Function to assess conversation completeness
function assessConversationCompleteness(speaker, conversationState, extractedInformation) {
  if (!speaker || speaker === 'Navarro') return { isComplete: false, completionRate: 0 };
  
  const characterData = conversationState.characters[speaker];
  const extractedInfo = extractedInformation[speaker] || [];
  
  // Define expected information for each character
  const expectedInfo = {
    'Marvin Lott': [
      'Heard scream around 3:30 AM',
      'Called 911 after hearing scream',
      'Waited 15 minutes before calling',
      'Heard furniture moving after scream',
      'Saw someone leave building around 3:45-4:00 AM',
      'Mentioned seeing visitors at victim\'s apartment'
    ],
    'Rachel Kim': [
      'Claims found body at 8:00 AM for breakfast',
      'Claims to be victim\'s best friend',
      'Mentioned Jordan (ex-boyfriend)',
      'Described someone as jealous/angry'
    ],
    'Jordan Valez': [
      'Claims was at Lockwood Bar',
      'Has Uber receipt as alibi',
      'Mentioned restraining order was misunderstanding',
      'Described Rachel as overly involved'
    ]
  };
  
  const expected = expectedInfo[speaker] || [];
  if (expected.length === 0) return { isComplete: false, completionRate: 0 };
  
  const extractedCount = extractedInfo.length;
  const expectedCount = expected.length;
  const completionRate = Math.round((extractedCount / expectedCount) * 100);
  
  // Consider complete if 70% or more information is extracted
  const isComplete = completionRate >= 70;
  
  return {
    isComplete,
    completionRate,
    extractedCount,
    expectedCount,
    missingInfo: expected.filter(info => !extractedInfo.includes(info))
  };
}

// Add this conversation history tracking system to your codebase
function trackConversationHistory(speaker, content, isQuestion, setState, gameState) {
  if (!speaker || speaker === 'System') return;
  
  setState(prevState => {
    // Skip if no current character (e.g., general game messages)
    if (!prevState.currentCharacter && speaker !== 'Navarro') return prevState;
    
    // Determine which character we're tracking (speaker or current conversation partner)
    const characterToTrack = (speaker === 'Navarro' || speaker === gameState.detectiveName) 
      ? prevState.currentCharacter 
      : speaker;
    
    if (!characterToTrack) return prevState;
    
    // Get existing character data or create default
    const characterData = prevState.characters[characterToTrack] || {
      history: [],
      lastInteractionTime: null,
      state: 'INITIAL',
      topicsDiscussed: []
    };
    
    // Analyze the content for significant elements
    const analysis = analyzeDialogueContext(content, gameState);
    
    // Detect potential contradictions or inconsistencies
    const contradictions = detectContradictions(
      characterToTrack, 
      content, 
      analysis, 
      characterData.history || []
    );
    
    // Create the history entry
    const historyEntry = {
      timestamp: gameState.currentTime,
      speaker: speaker,
      content: content,
      isQuestion: isQuestion,
      analysis: analysis,
      contradictions: contradictions,
      gameState: {
        leads: gameState.leads || [],
        evidence: gameState.evidence || [],
        timeElapsed: gameState.timeElapsed || 0
      }
    };
    
    // Add history entry and maintain a reasonable history size (last 20 exchanges)
    const updatedHistory = [...(characterData.history || []), historyEntry]
      .slice(-20);
    
    // Return the updated state
    return {
      ...prevState,
      characters: {
        ...prevState.characters,
        [characterToTrack]: {
          ...characterData,
          history: updatedHistory,
          lastInteractionTime: gameState.currentTime,
          contradictions: [
            ...(characterData.contradictions || []),
            ...contradictions
          ]
        }
      }
    };
  });
}

// Helper function to detect contradictions in statements
function detectContradictions(character, content, analysis, history) {
  const contradictions = [];
  const lowerContent = content.toLowerCase();
  
  // Skip contradiction detection for the detective or Navarro
  if (character === 'Navarro' || !character) return contradictions;
  
  // Simple time-based contradiction detection
  if (lowerContent.includes('time') || 
      lowerContent.includes('when') || 
      analysis.topics.includes('timing')) {
    
    // Look for times mentioned in the current statement
    const timePattern = /(\d{1,2})[:\.]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/gi;
    const timeMatches = [...lowerContent.matchAll(timePattern)];
    
    // Check previous statements about time
    const timeHistory = history.filter(entry => 
      entry.analysis && 
      (entry.analysis.topics.includes('timing') || 
       entry.content.toLowerCase().match(timePattern))
    );
    
    // If we found times in both current and previous statements, check for contradictions
    if (timeMatches.length > 0 && timeHistory.length > 0) {
      // This is a simplified check - in a real system, you'd parse and compare actual times
      if (timeMatches[0][0] !== timeHistory[0].content.toLowerCase().match(timePattern)?.[0][0]) {
        contradictions.push({
          type: 'time_inconsistency',
          currentStatement: content,
          previousStatement: timeHistory[0].content,
          detectionTime: new Date().toISOString()
        });
      }
    }
  }
  
  // Check for alibi contradictions
  if (analysis.topics.includes('alibi')) {
    const alibiHistory = history.filter(entry => 
      entry.analysis && entry.analysis.topics.includes('alibi')
    );
    
    if (alibiHistory.length > 0) {
      // Simple keyword-based contradiction detection
      const currentKeywords = extractKeywords(lowerContent);
      const previousKeywords = extractKeywords(alibiHistory[0].content.toLowerCase());
      
      // Check for different location mentions
      const locationWords = ['home', 'house', 'apartment', 'bar', 'restaurant', 'work', 'office'];
      const currentLocations = currentKeywords.filter(word => locationWords.includes(word));
      const previousLocations = previousKeywords.filter(word => locationWords.includes(word));
      
      if (currentLocations.length > 0 && 
          previousLocations.length > 0 && 
          !currentLocations.some(loc => previousLocations.includes(loc))) {
        contradictions.push({
          type: 'alibi_inconsistency',
          currentStatement: content,
          previousStatement: alibiHistory[0].content,
          detectionTime: new Date().toISOString()
        });
      }
    }
  }
  
  // Check for relationship contradictions
  if (analysis.topics.includes('relationships')) {
    const relationshipHistory = history.filter(entry => 
      entry.analysis && entry.analysis.topics.includes('relationships')
    );
    
    if (relationshipHistory.length > 0) {
      // Check for sentiment shifts about the victim
      const currentSentiment = getSentimentAboutVictim(lowerContent);
      const previousSentiment = getSentimentAboutVictim(relationshipHistory[0].content.toLowerCase());
      
      if (currentSentiment && previousSentiment && 
          currentSentiment !== previousSentiment && 
          (currentSentiment === 'negative' || previousSentiment === 'negative')) {
        contradictions.push({
          type: 'relationship_inconsistency',
          currentStatement: content,
          previousStatement: relationshipHistory[0].content,
          detectionTime: new Date().toISOString()
        });
      }
    }
  }
  
  return contradictions;
}

// Helper function to extract keywords from text
function extractKeywords(text) {
  // Remove common words and punctuation
  const stopWords = ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 
    'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 
    'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 
    'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 
    'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 
    'with', 'about', 'against', 'between', 'into', 'through', 'during', 
    'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 
    'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 
    'can', 'will', 'just', 'don', 'should', 'now'];
  
  const words = text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .toLowerCase()
    .split(/\s+/);
  
  return words.filter(word => !stopWords.includes(word));
}

// Helper to detect sentiment about the victim
function getSentimentAboutVictim(text) {
  const positivePhrases = [
    'good friend', 'liked her', 'love her', 'great person', 'wonderful', 
    'miss her', 'close', 'helped me', 'kind', 'sweet', 'caring'
  ];
  
  const negativePhrases = [
    'problem', 'issues', 'difficult', 'annoying', 'fight', 'argument', 
    'angry', 'upset', 'mad at', 'hate', 'dislike', 'trouble', 'bad'
  ];
  
  if (positivePhrases.some(phrase => text.includes(phrase))) {
    return 'positive';
  }
  
  if (negativePhrases.some(phrase => text.includes(phrase))) {
    return 'negative';
  }
  
  return 'neutral';
}
// Enhanced character mention detection
// Enhanced character mention detection - update your existing function
function detectCharacterMention(text, currentState, gameState) {
  const lowerText = text.toLowerCase();
  console.log('🔍 Detecting character in:', lowerText);

  // Comprehensive character alias mapping with weighted scores
  const characterAliases = {
    'Marvin Lott': {
      direct: ['marvin', 'lott', 'mr. lott', 'mr lott'],
      roles: ['neighbor', 'neighbour', 'the neighbor', 'guy next door', 'man next door', 'witness'],
      descriptive: ['nervous guy', 'man who called', 'caller', 'who reported'],
      locations: ['next door', 'apartment 2b', 'neighboring apartment']
    },
    'Rachel Kim': {
      direct: ['rachel', 'kim', 'ms. kim', 'ms kim', 'miss kim'],
      roles: ['best friend', 'friend', 'roommate', 'close friend', 'bestie', 'bff'],
      descriptive: ['asian woman', 'mia\'s friend', 'woman who found body', 'finder'],
      locations: ['friend\'s place', 'kim residence', 'rachel\'s apartment']
    },
    'Jordan Valez': {
      direct: ['jordan', 'valez', 'mr. valez', 'mr valez'],
      roles: ['ex', 'boyfriend', 'ex-boyfriend', 'former boyfriend', 'ex boyfriend'],
      descriptive: ['jealous ex', 'angry ex', 'former lover', 'the ex'],
      locations: ['jordan\'s apartment', 'ex\'s place', 'valez residence']
    }
  };
  
  // Contextual mention detection with scoring
  const characterScores = {};
  
  // Initialize scores
  Object.keys(characterAliases).forEach(char => {
    characterScores[char] = 0;
  });
  
  // Check direct name references (highest priority)
  Object.entries(characterAliases).forEach(([character, aliases]) => {
    aliases.direct.forEach(alias => {
      if (lowerText.includes(alias)) {
        characterScores[character] += 10;
      }
    });
    
    aliases.roles.forEach(alias => {
      if (lowerText.includes(alias)) {
        characterScores[character] += 5;
      }
    });
    
    aliases.descriptive.forEach(alias => {
      if (lowerText.includes(alias)) {
        characterScores[character] += 3;
      }
    });
    
    aliases.locations.forEach(alias => {
      if (lowerText.includes(alias)) {
        characterScores[character] += 4;
      }
    });
  });
  
  // Action phrases detection with context
  const actionPhrases = [
    { phrase: 'talk to', weight: 8 },
    { phrase: 'speak with', weight: 8 },
    { phrase: 'interview', weight: 9 },
    { phrase: 'ask', weight: 7 },
    { phrase: 'go to', weight: 6 },
    { phrase: 'visit', weight: 6 },
    { phrase: 'meet', weight: 7 },
    { phrase: 'find', weight: 5 },
    { phrase: 'question', weight: 9 },
    { phrase: 'interrogate', weight: 10 },
    { phrase: 'see', weight: 4 },
    { phrase: 'check on', weight: 5 }
  ];
  
  // Check for action-character combinations
  Object.entries(characterAliases).forEach(([character, aliases]) => {
    // Combine all alias types for action detection
    const allAliases = [
      ...aliases.direct, 
      ...aliases.roles, 
      ...aliases.descriptive
    ];
    
    actionPhrases.forEach(action => {
      allAliases.forEach(alias => {
        if (lowerText.includes(`${action.phrase} ${alias}`)) {
          characterScores[character] += action.weight;
        }
      });
    });
  });
  
  // Context-based inference
  if (currentState.conversationPhase !== 'NONE' && currentState.currentCharacter) {
    // Continuing existing conversation
    if (!isEndingConversation(text, currentState)) {
      characterScores[currentState.currentCharacter] += 8;
    }
  }
  
  // Check for conversation history context
  const recentTopics = currentState.globalTopics || [];
  
  // If recently discussed a character, boost their score
  Object.keys(characterAliases).forEach(char => {
    if (recentTopics.includes(`person-${char}`)) {
      characterScores[char] += 2;
    }
  });
  
  // Check game state for contextual clues
  if (gameState) {
    // If at a character's location, boost their score
    if (gameState.location === "Marvin's Apartment") {
      characterScores["Marvin Lott"] += 6;
    } else if (gameState.location === "Rachel's House") {
      characterScores["Rachel Kim"] += 6;
    }
  }
  
  // Add flexible pattern matching for common phrases
  const flexiblePatterns = [
    { pattern: /\b(go|talk|speak).{0,10}(neighbor|marvin)/i, character: 'Marvin Lott', score: 8 },
    { pattern: /\b(visit|see|meet).{0,10}(neighbor|marvin)/i, character: 'Marvin Lott', score: 7 },
    { pattern: /\b(talk|speak).{0,10}(friend|rachel)/i, character: 'Rachel Kim', score: 8 },
    { pattern: /\b(visit|see|meet).{0,10}(friend|rachel)/i, character: 'Rachel Kim', score: 7 },
    { pattern: /\b(talk|speak).{0,10}(ex|jordan|boyfriend)/i, character: 'Jordan Valez', score: 8 },
    { pattern: /\b(visit|see|meet).{0,10}(ex|jordan|boyfriend)/i, character: 'Jordan Valez', score: 7 }
  ];
  
  flexiblePatterns.forEach(pattern => {
    if (pattern.pattern.test(text)) {
      characterScores[pattern.character] += pattern.score;
    }
  });
  
  // Find the highest scoring character with debug logging
  let highestScore = 0;
  let detectedCharacter = null;
  
  console.log('🎯 Character scores:', characterScores);
  
  Object.entries(characterScores).forEach(([character, score]) => {
    if (score > highestScore) {
      highestScore = score;
      detectedCharacter = character;
    }
  });
  
  // Only return a character if the score is significant
  if (highestScore >= 5) {
    console.log(`✅ Detected ${detectedCharacter} with score ${highestScore}`);
    return detectedCharacter;
  }
  
  console.log(`❌ No character detected with significant confidence (highest: ${highestScore})`);
  return null;
}

// Enhanced conversation ending detection
// Enhanced conversation ending detection - UPDATE the existing function body
const enhancedConversationEndingDetection = useCallback((text, currentState) => {
  // If we're not in a conversation, we can't end one
  if (!currentState.currentCharacter) return false;

  const lowerText = text.toLowerCase();
  
  // Comprehensive list of goodbye phrases
  const goodbyePhrases = [
    'goodbye', 'bye', 'see you', 'thanks', 'thank you', 'later',
    'that will be all', 'that is all', 'that\'s all', 'that\'s it',
    'if we need', 'we will find you', 'find you later', 'catch you later',
    'contact you', 'that helps', 'let\'s go', 'let\'s leave', 'appreciate it',
    'i should go', 'need to go', 'moving on', 'leave now', 'gotta go',
    'go back', 'return to', 'head back', 'enough for now', 'that should do it',
    'wrap this up', 'done here', 'finished here', 'all set', 'all done'
  ];
  
  // Movement phrases that indicate leaving
  const movementPhrases = [
    'go back to', 'return to', 'leave', 'exit', 'head to',
    'go to the', 'check out', 'investigate', 'examine', 'visit',
    'look at', 'search', 'head over to', 'check on', 'move to'
  ];
  
  // Location references that indicate movement away
  const locationReferences = [
    'crime scene', 'apartment', 'station', 'lab', 'office', 
    'hallway', 'bathroom', 'kitchen', 'bedroom', 'building'
  ];
  
  // Check for explicit goodbyes
  const isGoodbye = goodbyePhrases.some(phrase => {
    if (!lowerText.includes(phrase)) return false;
    
    // Don't treat "thanks" as goodbye if it's followed by a question
    if (phrase === 'thanks' && lowerText.includes('?')) {
      return false;
    }
    
    return true;
  });
  
  // Check for movement away from the conversation
  const isMovingAway = currentState.currentCharacter && 
                      (movementPhrases.some(phrase => lowerText.includes(phrase)) &&
                      locationReferences.some(location => lowerText.includes(location)) &&
                      !lowerText.includes(currentState.currentCharacter.toLowerCase()));
  
  // Check for questions directed to another person (like Navarro)
  const isRedirectingConversation = lowerText.includes('navarro') || 
                                   (lowerText.includes('what do you think') && 
                                   !lowerText.includes(currentState.currentCharacter.toLowerCase()));
  
  const isEnding = isGoodbye || isMovingAway || isRedirectingConversation;
  
  console.log('🔍 Checking if ending conversation:', isEnding, {
    isGoodbye,
    isMovingAway,
    isRedirectingConversation
  });
  
  return isEnding;
}, []);

// Enhanced topic extraction function
function extractTopics(text) {
  const topics = [];
  const lowerText = text.toLowerCase();
  
  // Comprehensive topic detection for investigation
  const topicPatterns = {
    'noise': ['scream', 'heard', 'sound', 'noise', 'loud', 'yell', 'shout', 'bang'],
    'timing': ['time', 'clock', 'when', 'hour', 'minute', 'morning', 'night', 'yesterday', 'today', 'evening', 'afternoon', 'o\'clock'],
    'victim': ['mia', 'victim', 'rodriguez', 'dead', 'body', 'murdered', 'girl', 'woman', 'deceased'],
    'relationships': ['relationship', 'friend', 'knew', 'close', 'dating', 'partner', 'boyfriend', 'girlfriend', 'lover', 'married', 'together', 'roommate'],
    'witness': ['see', 'saw', 'witness', 'noticed', 'observed', 'spotted', 'watching', 'looked', 'glanced', 'viewed'],
    'entry': ['door', 'window', 'entry', 'break-in', 'lock', 'key', 'forced', 'broke in', 'access', 'entered', 'entrance'],
    'weapon': ['knife', 'weapon', 'stab', 'blood', 'blade', 'sharp', 'cut', 'wound', 'injury', 'kill', 'murdered', 'stabbing'],
    'motive': ['why', 'reason', 'motive', 'angry', 'jealous', 'money', 'revenge', 'hate', 'fight', 'argument', 'dispute', 'grudge', 'threatened'],
    'alibi': ['where', 'alibi', 'during', 'night of', 'when it happened', 'that night', 'doing', 'location', 'at the time', 'whereabouts'],
    'background': ['history', 'past', 'background', 'previous', 'record', 'criminal', 'job', 'work', 'occupation', 'family', 'relatives', 'friends', 'social'],
    'physical_evidence': ['fingerprint', 'dna', 'hair', 'fiber', 'footprint', 'evidence', 'trace', 'sample', 'forensic', 'item', 'belonging', 'found', 'collected']
  };
  
  // Check for topic patterns in the dialogue
  for (const [topic, keywords] of Object.entries(topicPatterns)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic);
    }
  }
  
  console.log('📋 Extracted topics:', topics);
  return topics;
}

function isGeneralInvestigativeAction(text) {
  const lowerText = text.toLowerCase();
  
  // Enhanced photo/documentation detection with typo handling
  const photoPatterns = [
    'photograph', 'photo', 'picture', 'pic', 'pics',
    'pcitures', 'picures', 'pitcures', 'pictues', // common typos
    'take pic', 'take photo', 'take picture', 'snap', 'capture',
    'document', 'record', 'get some pic', 'get pic', 'get photo'
  ];
  
  // Investigation action keywords
  const investigationKeywords = [
    'examine', 'check', 'look at', 'search', 'investigate',
    'analyze', 'test', 'collect', 'gather', 'inspect',
    'forensic', 'lab', 'send to', 'process'
  ];
  
  // Natural language investigation patterns
  const investigationPatterns = [
    'crime scene', 'scene', 'evidence', 'clue', 'body',
    'apartment', 'room', 'door', 'window', 'floor',
    'wall', 'furniture', 'belongings', 'phone'
  ];
  
  // Check for photo/documentation actions
  const hasPhotoAction = photoPatterns.some(pattern => lowerText.includes(pattern));
  
  // Check for investigation keywords
  const hasInvestigationKeyword = investigationKeywords.some(keyword => lowerText.includes(keyword));
  
  // Check for investigation context (scene, evidence, etc.)
  const hasInvestigationContext = investigationPatterns.some(pattern => lowerText.includes(pattern));
  
  // Enhanced logic: photo action OR investigation keyword OR (investigation context + action words)
  const hasActionWords = /\b(get|take|do|go|start|begin|let|should|need|want)\b/.test(lowerText);
  
  return hasPhotoAction || hasInvestigationKeyword || (hasInvestigationContext && hasActionWords);
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
      conversationState,
      extractedInformation
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
    setExtractedInformation(savedState.extractedInformation || {});
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
    
    // Initialize game state first
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
    
    // Add the scene-photos lead after Navarro's intro with a short delay
    setTimeout(() => {
      setMsgs(prevMsgs => [
        ...prevMsgs,
        { speaker: 'System', content: '🕵️ New lead unlocked: Photograph the crime scene thoroughly.' }
      ]);
      
      // Add the lead to the leads array
      setLeads(['scene-photos']);
      
      // Add Navarro's narrative about the lead with another short delay
      setTimeout(() => {
        setMsgs(prevMsgs => [
          ...prevMsgs,
          { speaker: 'Navarro', content: 'The layout and positioning of items may reveal important clues about what happened.' }
        ]);
        
        // Add the interview-marvin lead after another short delay
        setTimeout(() => {
          setMsgs(prevMsgs => [
            ...prevMsgs,
            { speaker: 'System', content: '🕵️ New lead unlocked: Interview Marvin Lott about what he heard that night.' }
          ]);
          
          // Add both leads to the leads array
          setLeads(['scene-photos', 'interview-marvin']);
          
          // Add Navarro's narrative about interviewing Marvin
          setTimeout(() => {
            setMsgs(prevMsgs => [
              ...prevMsgs,
              { speaker: 'Navarro', content: 'As the reporting witness, his testimony about the timing and what he heard will be crucial.' }
            ]);
          }, 1000);
        }, 1500);
      }, 1000);
    }, 1500);
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
      }
    });
    
    // Clear pending notifications
    setPendingNotifications([]);
  };

  // Enhanced topic detection system - place this after your existing extractTopics function
  function analyzeDialogueContext(text, gameState) {
    const results = {
      topics: [],
      evidenceReferences: [],
      characterReferences: [],
      emotionalTone: 'neutral',
      questionTypes: [],
      accusationLevel: 0
    };
    
    const lowerText = text.toLowerCase();
    
    // ---- 1. Extract basic topics using existing function ----
    results.topics = extractTopics(text);
    
    // ---- 2. Detect evidence references ----
    const evidenceKeywords = {
      'stab-wound': ['stab', 'wound', 'knife mark', 'injury'],
      'no-forced-entry': ['forced entry', 'break in', 'lock', 'window'],
      'partial-cleaning': ['clean', 'wipe', 'blood', 'cleaned up'],
      'missing-phone': ['phone', 'cell', 'mobile', 'call'],
      'locked-door': ['locked', 'door', 'from inside', 'locked from'],
      'bloodstain': ['blood', 'stain', 'pattern', 'spatter'],
      'bracelet-charm': ['bracelet', 'charm', 'jewelry', 'accessory']
    };
    
    // Check for evidence references
    Object.entries(evidenceKeywords).forEach(([evidenceId, keywords]) => {
      if (keywords.some(word => lowerText.includes(word))) {
        results.evidenceReferences.push(evidenceId);
      }
    });
    
    // ---- 3. Detect character references ----
    const characterKeywords = {
      'Marvin Lott': ['marvin', 'lott', 'neighbor', 'neighbour'],
      'Rachel Kim': ['rachel', 'kim', 'friend', 'best friend'],
      'Jordan Valez': ['jordan', 'valez', 'boyfriend', 'ex']
    };
    
    // Check for character references
    Object.entries(characterKeywords).forEach(([character, keywords]) => {
      if (keywords.some(word => lowerText.includes(word))) {
        results.characterReferences.push(character);
      }
    });
    
    // ---- 4. Analyze emotional tone ----
    const emotionKeywords = {
      'angry': ['angry', 'mad', 'furious', 'outraged', 'upset', 'frustrated'],
      'sad': ['sad', 'depressed', 'miserable', 'unhappy', 'heartbroken'],
      'fearful': ['afraid', 'scared', 'frightened', 'terrified', 'worried', 'nervous'],
      'confused': ['confused', 'puzzled', 'bewildered', 'unsure', 'uncertain'],
      'suspicious': ['suspicious', 'doubt', 'questionable', 'fishy', 'skeptical'],
      'sympathetic': ['sorry', 'sympathy', 'understand', 'condolences', 'feel for you'],
      'threatening': ['threat', 'warning', 'careful', 'watch out', 'better not']
    };
    
    // Determine emotional tone
    let dominantEmotion = 'neutral';
    let highestCount = 0;
    
    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      const count = keywords.filter(word => lowerText.includes(word)).length;
      if (count > highestCount) {
        highestCount = count;
        dominantEmotion = emotion;
      }
    });
    
    results.emotionalTone = highestCount > 0 ? dominantEmotion : 'neutral';
    
    // ---- 5. Detect question types ----
    const questionPatterns = {
      'timeline': ['when', 'what time', 'how long', 'what day', 'during'],
      'location': ['where', 'which place', 'location', 'what room'],
      'motivation': ['why', 'reason', 'motive', 'what for', 'purpose'],
      'method': ['how', 'what way', 'manner', 'means', 'technique'],
      'identity': ['who', 'which person', 'name', 'identify']
    };
    
    // Check for question types
    Object.entries(questionPatterns).forEach(([questionType, patterns]) => {
      if (patterns.some(pattern => lowerText.includes(pattern) && 
                                 (lowerText.includes('?') || 
                                  lowerText.startsWith('tell me') ||
                                  lowerText.startsWith('i want to know')))) {
        results.questionTypes.push(questionType);
      }
    });
    
    // ---- 6. Analyze accusation level ----
    const accusationKeywords = [
      'lie', 'lying', 'liar', 'truth', 'honest', 'hiding', 'suspicious',
      'alibi', 'prove', 'guilty', 'innocent', 'killed', 'murder', 'murderer'
    ];
    
    // Calculate accusation level (0-5)
    const accusationCount = accusationKeywords.filter(word => lowerText.includes(word)).length;
    results.accusationLevel = Math.min(5, accusationCount);
    
    // Include related evidence and characters in topics
    results.topics = [...new Set([
      ...results.topics,
      ...results.evidenceReferences.map(ev => `evidence-${ev}`),
      ...results.characterReferences.map(char => `person-${char}`)
    ])];
    
    console.log('🔍 Dialogue analysis:', results);
    return results;
  }

  // Add this function to update the global conversation context based on dialogue
  function updateConversationContext(speakerName, text, gameState, setConversationState) {
    if (!speakerName || speakerName === 'System') return;
    
    // Analyze the dialogue
    const analysis = analyzeDialogueContext(text, gameState);
    
    // Update the conversation state based on the analysis
    setConversationStateWithValidation(prev => {
      // Get existing character data or create new
      const character = prev.characters[speakerName] || {
        topicsDiscussed: [],
        state: 'INITIAL',
        relationshipLevel: 0,
        suspicionLevel: 0,
        mood: 'neutral',
        emotionalResponses: {},
        questionHistory: [],
        contradictions: []
      };
      
      // Track emotional responses
      const emotionalResponses = {...character.emotionalResponses};
      if (analysis.emotionalTone !== 'neutral') {
        emotionalResponses[analysis.emotionalTone] = 
          (emotionalResponses[analysis.emotionalTone] || 0) + 1;
      }
      
      // Track question history
      const questionHistory = [...(character.questionHistory || [])];
      if (analysis.questionTypes.length > 0) {
        questionHistory.push({
          types: analysis.questionTypes,
          timestamp: gameState.currentTime,
          text: text
        });
      }
      
      // Update suspicion level based on accusation level
      let suspicionLevel = character.suspicionLevel || 0;
      if (analysis.accusationLevel > 0) {
        // Increase suspicion if character is accused
        if (speakerName !== 'Navarro' && speakerName !== gameState.detectiveName) {
          suspicionLevel = Math.min(10, suspicionLevel + analysis.accusationLevel);
        }
      }
      
      // Update character's mood based on emotional tone
      let mood = character.mood || 'neutral';
      if (analysis.emotionalTone === 'threatening' || analysis.emotionalTone === 'angry') {
        mood = 'defensive';
      } else if (analysis.emotionalTone === 'sympathetic') {
        mood = 'appreciative';
      } else if (analysis.emotionalTone === 'suspicious') {
        mood = 'nervous';
      }
      
      // Return updated state
      return {
        ...prev,
        globalTopics: [...new Set([...(prev.globalTopics || []), ...analysis.topics])],
        characters: {
          ...prev.characters,
          [speakerName]: {
            ...character,
            topicsDiscussed: [...new Set([...character.topicsDiscussed, ...analysis.topics])],
            emotionalResponses,
            questionHistory,
            suspicionLevel,
            mood,
            // Track the last analyzed dialogue
            lastDialogue: {
              text,
              analysis,
              timestamp: gameState.currentTime
            }
          }
        }
      };
    });
  }

  // Helper function to format conversation history for the AI
  function getFormattedHistory(history, count) {
    if (!history || history.length === 0) return [];
    
    // Get the most recent exchanges
    const recentHistory = history.slice(-count);
    
    // Format them for inclusion in the AI context
    return recentHistory.map(entry => ({
      timestamp: entry.timestamp,
      speaker: entry.speaker,
      text: entry.content,
      topics: entry.analysis?.topics || [],
      emotion: entry.analysis?.emotionalTone || 'neutral',
      isQuestion: entry.isQuestion
    }));
  }

  // Consolidated investigative action handler
  function handleInvestigativeAction(input) {
    // Add scene transition for crime scene investigation
    if (input.toLowerCase().includes('apartment') || input.toLowerCase().includes('crime scene') || 
        input.toLowerCase().includes('back to') || input.toLowerCase().includes('scene') ||
        input.toLowerCase().includes('photograph') || input.toLowerCase().includes('document') ||
        input.toLowerCase().includes('examine') || input.toLowerCase().includes('investigate')) {
      
      // Check if this is a return visit or initial investigation
      const isReturning = input.toLowerCase().includes('back to') || input.toLowerCase().includes('return');
      const transitionMessage = isReturning 
        ? `*You return to ${LOCATION} to investigate further.*`
        : `*You begin investigating ${LOCATION} thoroughly.*`;
        
      setMsgs(m => [...m, { 
        speaker: 'System', 
        content: transitionMessage
      }]);
    }
    
    handleSceneTransition(
      conversationState.currentCharacter,
      null,
      'TRANSITION_TO_INVESTIGATION',
      setConversationState,
      {
        currentTime: currentClock(),
        setMsgs,
        setTimeElapsed,
        setTimeRemaining,
        conversationState
      }
    );
    
    // Set conversation state for investigation
    setConversationStateWithValidation(prev => ({
      ...prev,
      pendingAction: 'INVESTIGATE',
      conversationPhase: prev.currentCharacter ? 'CONCLUDING' : 'NONE'
    }));
    
    // Process game engine action
    const gameEngineResult = applyAction({
      timeElapsed,
      timeRemaining,
      evidence,
      leads,
      actionsPerformed,
      interviewsCompleted,
      interviewCounts
    }, input);
    
    if (gameEngineResult.error) {
      setMsgs(m => [...m, { speaker: 'Navarro', content: `❌ ${gameEngineResult.error}` }]);
    } else {
      // Update game state
      setTimeElapsed(gameEngineResult.newState.timeElapsed);
      setTimeRemaining(gameEngineResult.newState.timeRemaining);
      setActionsPerformed(gameEngineResult.newState.actionsPerformed);
      
      // Process discovered evidence and leads
      if (gameEngineResult.discoveredEvidence && gameEngineResult.discoveredEvidence.length > 0) {
        console.log('🔍 Evidence discovered in handleInvestigativeAction:', gameEngineResult.discoveredEvidence);
        setEvidence(gameEngineResult.newState.evidence);
        
        // Collect all evidence and commentary for consolidated messages
        const evidenceDescriptions = [];
        const commentaries = [];
        
        gameEngineResult.discoveredEvidence.forEach(evidenceId => {
          const evidenceDef = evidenceDefinitions.find(e => e.id === evidenceId);
          if (evidenceDef) {
            console.log('🔍 Processing evidence notification in main flow for:', evidenceId, evidenceDef);
            
            // Collect evidence description
            evidenceDescriptions.push(`• ${evidenceDef.description}`);
            
            // Show notepad notification immediately (for popup)
            showNotepadNotification('evidence', evidenceDef);
            
            // Collect Navarro's commentary
            const commentary = getEvidenceCommentary(evidenceDef.id);
            if (commentary) {
              commentaries.push(commentary);
            }
          }
        });
        
        // Add single consolidated evidence discovery message
        if (evidenceDescriptions.length > 0) {
          setMsgs(m => [
            ...m, 
            { 
              speaker: 'System', 
              content: `🔍 Evidence discovered:\n${evidenceDescriptions.join('\n')}`
            }
          ]);
        }
        
        // Add single consolidated Navarro commentary message
        if (commentaries.length > 0) {
          setMsgs(m => [
            ...m,
            {
              speaker: 'Navarro',
              content: commentaries.join(' ')
            }
          ]);
        }
        
        // Add scene ending transition after evidence discovery
        setTimeout(() => {
          console.log('🔚 Adding scene ending transition after evidence discovery');
          
          // Add system message indicating scene completion
          setMsgs(m => [...m, { 
            speaker: 'System', 
            content: '*You finish documenting the crime scene thoroughly, capturing all visible evidence.*'
          }]);
          
          // Check if photography was just completed to suggest apartment search
          const photographyEvidence = ['stab-wound', 'no-forced-entry', 'partial-cleaning', 'locked-door', 'bloodstain'];
          const justCompletedPhotography = gameEngineResult.discoveredEvidence?.some(ev => 
            photographyEvidence.includes(ev)
          );
          
          // Add context-appropriate Navarro follow-up
          if (justCompletedPhotography) {
            // Add apartment search lead after photography completion
            const apartmentSearchLead = leadDefinitions.find(l => l.id === 'apartment-search');
            if (apartmentSearchLead && !leads.includes('apartment-search')) {
              setLeads(prev => [...prev, 'apartment-search']);
              
              // Add lead notification
              setMsgs(m => [...m, { 
                speaker: 'System', 
                content: `🕵️ New lead unlocked: ${apartmentSearchLead.description}`
              }]);
              setMsgs(m => [...m, { 
                speaker: 'Navarro', 
                content: apartmentSearchLead.narrative
              }]);
            }
            
            setMsgs(m => [...m, { 
              speaker: 'Navarro', 
              content: 'Good work. We\'ve got a solid foundation now. The photos show the basics, but we might have missed something. A thorough search of the apartment could turn up evidence the killer left behind.'
            }]);
          } else {
            setMsgs(m => [...m, { 
              speaker: 'Navarro', 
              content: 'Good work. We\'ve got a solid foundation now. What\'s our next move, Detective?'
            }]);
          }
          
          // Reset conversation state to indicate scene completion
          setConversationStateWithValidation(prev => ({
            ...prev,
            currentCharacter: null,
            pendingAction: null,
            conversationPhase: 'NONE'
          }));
        }, 500);
      }
      
      if (gameEngineResult.newLeads && gameEngineResult.newLeads.length > 0) {
        console.log('🎯 New leads discovered:', gameEngineResult.newLeads);
        setLeads(prev => [...prev, ...gameEngineResult.newLeads.map(lead => lead.id)]);
        
        // Process lead notifications immediately during investigative actions
        gameEngineResult.newLeads.forEach(leadDef => {
          // Show lead notification in chat immediately
          setTimeout(() => {
            setMsgs(m => [
              ...m, 
              { 
                speaker: 'System', 
                content: `🕵️ New lead unlocked: ${leadDef.description}`
              }
            ]);
            
            // Show notepad notification
            showNotepadNotification('lead', leadDef);
            
            // If the lead has a narrative, add that as a follow-up from Navarro
            if (leadDef.narrative) {
              setTimeout(() => {
                setMsgs(m => [
                  ...m,
                  {
                    speaker: 'Navarro',
                    content: leadDef.narrative
                  }
                ]);
              }, 100);
            }
          }, 200);
        });
      }
    }
  }

  // Add transition state to prevent overlapping transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Add these scene transition functions to your codebase
  function handleSceneTransition(fromCharacter, toCharacter, action, setState, gameState) {
    // Prevent overlapping transitions
    if (isTransitioning) {
      console.log(`⏸️ Skipping transition: ${fromCharacter || 'none'} → ${toCharacter || 'none'} (${action}) - already transitioning`);
      return;
    }
    
    console.log(`🎬 Scene transition: ${fromCharacter || 'none'} → ${toCharacter || 'none'} (${action})`);
    setIsTransitioning(true);
    
    // Step 1: Conclude current conversation if applicable
    if (fromCharacter) {
      concludeConversation(fromCharacter, setState, gameState);
    }
    
    // Step 2: Generate appropriate transition narrative
    const transitionMessage = generateTransitionNarrative(fromCharacter, toCharacter, action, gameState);
    
    if (transitionMessage) {
      // Add the transition message to the message list
      gameState.setMsgs(msgs => [...msgs, { 
        speaker: 'System', 
        content: transitionMessage 
      }]);
    }
    
    // Step 3: If moving to a new character, prepare for that conversation
    if (toCharacter && toCharacter !== fromCharacter) {
      prepareNewConversation(toCharacter, setState, gameState);
    }
    
    // Step 4: Apply any time costs for the transition
    applyTransitionTimeCosts(fromCharacter, toCharacter, action, gameState);
    
    // Reset transition state after a brief delay to allow processing
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100);
  }

  // Helper to conclude the current conversation
  function concludeConversation(character, setState, gameState) {
    setState(prevState => {
      // Get character data
      const characterData = prevState.characters[character] || {};
      
      // Mark conversation as concluded - but keep it in CONCLUDING phase to allow exit sequence
      return {
        ...prevState,
        conversationPhase: 'CONCLUDING', // Keep CONCLUDING to allow exit sequence
        currentCharacter: character, // Keep character for exit sequence
        pendingAction: 'END_CONVERSATION', // Keep END_CONVERSATION action
        characters: {
          ...prevState.characters,
          [character]: {
            ...characterData,
            lastInteractionTime: gameState.currentTime,
            // Record how the conversation ended
            conversationEndState: {
              time: gameState.currentTime,
              topics: characterData.topicsDiscussed || [],
              mood: characterData.mood || 'neutral',
              suspicionLevel: characterData.suspicionLevel || 0
            }
          }
        }
      };
    });
  }


  // Helper to prepare for a new conversation
  function prepareNewConversation(character, setState, gameState) {
    setState(prevState => {
      // Get existing character data or initialize
      const characterData = prevState.characters[character] || {
        state: 'INITIAL',
        topicsDiscussed: [],
        visitCount: 0,
        mood: 'neutral',
        suspicionLevel: 0
      };
      
      // Determine if this is a returning visit
      const isReturning = characterData.state === 'INITIAL' && characterData.visitCount > 0;
      
      // Prepare greeting phase
      return {
        ...prevState,
        currentCharacter: character,
        conversationPhase: 'GREETING',
        pendingAction: null,
        characters: {
          ...prevState.characters,
          [character]: {
            ...characterData,
            state: isReturning ? 'RETURNING' : 'INITIAL',
            visitCount: characterData.visitCount + 1,
            currentConversationStartTime: gameState.currentTime
          }
        }
      };
    });
  }

  // Helper to apply time costs for transitions
  function applyTransitionTimeCosts(fromCharacter, toCharacter, action, gameState) {
    let timeCost = 0;
    
    // Different costs based on transition type
    if (action === 'MOVE_TO_CHARACTER' && toCharacter) {
      // Cost to travel to a new character
      timeCost = 10; // 10 minutes to travel to a new location
    } 
    else if (action === 'END_CONVERSATION') {
      // Small cost to conclude conversation
      timeCost = 2; // 2 minutes to wrap up
    }
    
    // Apply the time cost
    if (timeCost > 0) {
      gameState.setTimeElapsed(te => te + timeCost);
      gameState.setTimeRemaining(tr => tr - timeCost);
    }
  }

  // —— STATE MANAGEMENT UTILITIES ——
  
  // Enhanced character memory persistence
  const preserveCharacterMemory = (characterName, interactionData, setState) => {
    if (!characterName) return;
    
    setState(prevState => {
      const existingCharacter = prevState.characters[characterName] || {};
      
      return {
        ...prevState,
        characters: {
          ...prevState.characters,
          [characterName]: {
            ...existingCharacter,
            ...interactionData,
            lastInteractionTime: currentClock(),
            // Maintain conversation continuity
            conversationHistory: [
              ...(existingCharacter.conversationHistory || []),
              {
                timestamp: currentClock(),
                topics: interactionData.topicsDiscussed || [],
                mood: interactionData.mood || 'neutral',
                suspicionLevel: interactionData.suspicionLevel || 0
              }
            ].slice(-5) // Keep only last 5 interactions
          }
        }
      };
    });
  };

  // Reset conversation state while preserving character memory
  const resetToNeutralState = () => {
    console.log('🔄 Resetting to neutral state while preserving character memory');
    
    // First preserve current character memory if there's an active conversation
    if (conversationState.currentCharacter) {
      preserveCharacterMemory(
        conversationState.currentCharacter,
        conversationState.characters[conversationState.currentCharacter] || {},
        setConversationStateWithValidation
      );
    }
    
    setConversationStateWithValidation(prev => ({
      ...prev,
      // Clear transient state
      currentCharacter: null,
      conversationPhase: 'NONE',
      pendingAction: null,
      lastTopicDetected: null,
      consecutiveQuestions: 0,
      
      // Preserve ALL persistent character memory
      characters: prev.characters || {},
      globalTopics: prev.globalTopics || []
    }));
  };
  
  // Classify action type for proper routing
  const classifyAction = (input) => {
    const isInvestigativeAction = isGeneralInvestigativeAction(input);
    const mentionedCharacter = detectCharacterMention(
      input, 
      conversationState,
      {
        location: LOCATION,
        time: currentClock(),
        evidence: evidence,
        leads: leads
      }
    );
    
    if (isInvestigativeAction) return 'INVESTIGATIVE';
    if (mentionedCharacter) return 'CHARACTER_INTERACTION';
    if (input.toLowerCase().includes('navarro') && !mentionedCharacter) return 'ASK_NAVARRO';
    return 'GENERAL';
  };

  // —— PROXY CALL ——
//send message
const sendMessage = async () => {
  console.log('🚀 Starting sendMessage with current state:', {
    conversationPhase: conversationState.conversationPhase,
    currentCharacter: conversationState.currentCharacter,
    pendingAction: conversationState.pendingAction
  });
  if (!input.trim()) return;
  
  const actionText = input; // Define actionText at the start
  
  setMsgs(m => [...m, { speaker: detectiveName, content: actionText }]);
  setLoading(true);
  
  // Step 1: Extract current character and state from conversationState BEFORE any modifications
  const currentCharacter = conversationState.currentCharacter;
  const pendingAction = conversationState.pendingAction;
  
  // Step 2: Detect targets and classify action type
  const mentionedCharacter = detectCharacterMention(
    actionText, 
    conversationState,
    {
      location: LOCATION,
      time: currentClock(),
      evidence: evidence,
      leads: leads
    }
  );
  
  const actionType = classifyAction(actionText);
  console.log('🎯 Action classified as:', actionType, 'with mentioned character:', mentionedCharacter);
  
  // Check if the message is ending a conversation
  const isEnding = enhancedConversationEndingDetection(actionText, conversationState);
  
  // Step 3: Handle state transitions based on action type and context
  if (actionType === 'INVESTIGATIVE' && !mentionedCharacter) {
    // Pure investigative actions reset to neutral state
    resetToNeutralState();
    await new Promise(resolve => setTimeout(resolve, 10));
  } else if (mentionedCharacter && mentionedCharacter !== currentCharacter) {
    // Transitioning to a new character - preserve memory but change context
    console.log(`🔄 Transitioning from ${currentCharacter || 'none'} to ${mentionedCharacter}`);
    
    // Handle scene transition properly
    handleSceneTransition(
      currentCharacter,
      mentionedCharacter,
      'MOVE_TO_CHARACTER',
      setConversationStateWithValidation,
      {
        currentTime: currentClock(),
        setMsgs,
        setTimeElapsed,
        setTimeRemaining,
        detectiveName,
        actionText
      }
    );
    
    await new Promise(resolve => setTimeout(resolve, 10));
  }

// Step 3: Process action based on type
if (actionType === 'INVESTIGATIVE') {
  console.log('🔍 Processing investigative action:', input);
  
  // Handle investigative action processing (includes its own Navarro commentary)
  handleInvestigativeAction(input);
  
  // For investigative actions, end here to prevent duplicate AI processing
  setLoading(false);
  setInput('');
  return;
}

// Update conversation state based on context
if (conversationState.conversationPhase === 'CONCLUDING') {
  console.log('🔚 Already concluding conversation, continuing END_CONVERSATION flow');
  setConversationStateWithValidation(prev => ({
    ...prev,
    pendingAction: 'END_CONVERSATION'
  }));
} else if (mentionedCharacter && mentionedCharacter !== currentCharacter) {
  // Character transition already handled above - add Navarro affirmation
  console.log('✅ Character transition already processed, adding Navarro affirmation');
  
  // Add Navarro's affirmation for character transitions
  const affirmation = getNavarroAffirmation(actionText);
  setMsgs(m => [...m, { speaker: 'Navarro', content: affirmation }]);
  
  // Add automatic stage direction for approaching the character  
  const isFirstTime = !conversationState.characters[mentionedCharacter]?.visitCount || 
                     conversationState.characters[mentionedCharacter]?.visitCount === 0;
  
  if (isFirstTime) {
    // Add automatic stage direction for approaching and knocking on door
    setMsgs(m => [...m, { 
      speaker: 'System', 
      content: `*You approach ${mentionedCharacter} to speak with them.*` 
    }]);
    
    // Add automatic knocking stage direction
    setMsgs(m => [...m, { 
      speaker: 'System', 
      content: `*You knock on the door.*` 
    }]);
  }
} else if (currentCharacter && isEnding) {
  // Assess conversation completeness before ending
  const completeness = assessConversationCompleteness(currentCharacter, conversationState, extractedInformation);
  
  // Provide natural feedback only for good questioning
  if (completeness.completionRate >= 70) {
    setMsgs(m => [...m, { 
      speaker: 'Navarro', 
      content: `Good questioning. We can always circle back if needed.` 
    }]);
  }
  // No feedback for incomplete conversations - just proceed with natural Navarro affirmation
  
  // Ending conversation - handle scene transition
  handleSceneTransition(
    currentCharacter,
    null,
    'END_CONVERSATION',
    setConversationState,
    {
      currentTime: currentClock(),
      setMsgs,
      setTimeElapsed,
      setTimeRemaining,
      conversationState
    }
  );
  
  // Set conversation state to reflect the conclusion - but don't set CONCLUDING if currentCharacter is null
  setConversationStateWithValidation(prev => ({
    ...prev,
    pendingAction: 'END_CONVERSATION',
    conversationPhase: prev.currentCharacter ? 'CONCLUDING' : 'NONE'
  }));
} else if (currentCharacter && !isEnding) {
  // Continuing conversation with current character
  console.log(`🔧 Continuing conversation with ${currentCharacter}`);
  setConversationStateWithValidation(prev => ({
    ...prev,
    pendingAction: 'CONTINUE_CONVERSATION',
    conversationPhase: 'QUESTIONING'
  }));
} else if (actionType === 'ASK_NAVARRO') {
  console.log('🤝 Processing Navarro consultation');
  setConversationStateWithValidation(prev => ({
    ...prev,
    pendingAction: 'ASK_NAVARRO',
    currentCharacter: 'Navarro',
    conversationPhase: 'NONE'
  }));
} else if (actionType === 'GENERAL') {
  console.log('💬 Processing general conversation/continuation');
  // For general conversation, preserve current state
  // No specific state changes needed
}
  
  // This code replaces the try/catch block in the sendMessage function
  try {
    const conversationContext = currentCharacter
    ? {
        character: currentCharacter,
        state: conversationState.characters[currentCharacter]?.state || 'INITIAL',
        topicsDiscussed: conversationState.characters[currentCharacter]?.topicsDiscussed || [],
        visitCount: conversationState.characters[currentCharacter]?.visitCount || 0,
        mood: conversationState.characters[currentCharacter]?.mood || 'neutral',
        suspicionLevel: conversationState.characters[currentCharacter]?.suspicionLevel || 0,
        // Add conversation history
        recentHistory: getFormattedHistory(
          conversationState.characters[currentCharacter]?.history || [], 
          5 // Include last 5 exchanges
        ),
        // Add detected contradictions
        contradictions: conversationState.characters[currentCharacter]?.contradictions || []
      }
    : null;

    console.log('📤 Sending to proxy with calculated values:', {
      currentCharacter: mentionedCharacter || currentCharacter,
      pendingAction: conversationState.pendingAction,
      conversationPhase: conversationState.conversationPhase,
      gameState: {
        pendingAction: conversationState.pendingAction,
        currentCharacter: mentionedCharacter || currentCharacter
      }
    });

    const history = [...msgs, { speaker: detectiveName, content: actionText }].map(m => ({
      role: m.speaker === 'System' ? 'system'
          : m.speaker === detectiveName ? 'user'
          : 'assistant',
      content: m.content
    }));
    
    // Sanitize data before sending to API
    const sanitizedPayload = sanitizeForJSON({
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
        pendingAction: mentionedCharacter && mentionedCharacter !== currentCharacter ? 'MOVE_TO_CHARACTER' : conversationState.pendingAction,
        currentCharacter: mentionedCharacter || currentCharacter
      }
    });

    const res = await fetch('http://localhost:3001/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizedPayload),
    });
    
    const { text } = await res.json();

    // —— DEBUG LOGS ——
    const lines = text.trim().split(/\r?\n/);
    const parsed = lines
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(o => o && (o.type === 'stage' || o.type === 'dialogue'));

    console.log('💬 RAW STREAM LINES:', lines);
    console.log('💬 PARSED OBJECTS:', parsed);
    
    // Debug: Log the actual dialogue text being processed
    if (parsed.length > 0) {
      parsed.forEach((obj, index) => {
        console.log(`💬 DEBUG Object ${index}:`, obj);
        if (obj.type === 'dialogue') {
          console.log(`💬 DIALOGUE TEXT: "${obj.text}"`);
          console.log(`💬 DIALOGUE SPEAKER: "${obj.speaker}"`);
        }
      });
    }

    // Process responses in the correct order
    const stageDirections = parsed.filter(obj => obj.type === 'stage');
    const dialogueResponses = parsed.filter(obj => obj.type === 'dialogue');
    
    // Check if we're transitioning to a new character
    const isTransitioningToCharacter = mentionedCharacter && mentionedCharacter !== currentCharacter;
    
    // If transitioning to a new character, handle the response differently
    if (isTransitioningToCharacter) {
      // Don't add any stage directions - we've already handled them manually
      
      // Only add dialogue responses from the character we're transitioning to
      const characterResponses = dialogueResponses.filter(obj => obj.speaker === mentionedCharacter);
      if (characterResponses.length > 0) {
        setMsgs(m => [...m, { 
          speaker: mentionedCharacter, 
          content: characterResponses[0].text 
        }]);
        
        // Track conversation for the first response
        trackConversationHistory(
          mentionedCharacter,
          characterResponses[0].text,
          false,
          setConversationState,
          {
            currentTime: fmt(currentClock()),
            timeElapsed: timeElapsed,
            detectiveName: detectiveName,
            evidence: evidence,
            leads: leads
          }
        );
        
        // Update conversation context for the first response
        updateConversationContext(
          mentionedCharacter,
          characterResponses[0].text,
          {
            currentTime: fmt(currentClock()),
            detectiveName: detectiveName,
            evidence: evidence,
            leads: leads
          },
          setConversationState
        );
        
        // Handle interview time costs and completion tracking
        if (!seenNpcInterviewed[mentionedCharacter]) {
          setTimeElapsed(te => te + ACTION_COSTS.interview);
          setTimeRemaining(tr => tr - ACTION_COSTS.interview);
          setSeenNpcInterviewed(s => ({ ...s, [mentionedCharacter]: true }));
          
          // Track interview completion for game engine
          setInterviewsCompleted(prev => {
            if (!prev.includes(mentionedCharacter)) {
              console.log('📋 Interview completed:', mentionedCharacter);
              return [...prev, mentionedCharacter];
            }
            return prev;
          });
          
          // Trigger game engine to check for new leads
          const gameEngineResult = applyAction({
            timeElapsed: timeElapsed + ACTION_COSTS.interview,
            timeRemaining: timeRemaining - ACTION_COSTS.interview,
            evidence,
            leads,
            actionsPerformed,
            interviewsCompleted: [...interviewsCompleted, mentionedCharacter],
            interviewCounts
          }, `interview ${mentionedCharacter}`);
          
          // Process any new leads discovered
          if (gameEngineResult.newLeads && gameEngineResult.newLeads.length > 0) {
            console.log('🎯 New leads discovered:', gameEngineResult.newLeads);
            
            // Update leads state
            setLeads(prev => [...prev, ...gameEngineResult.newLeads.map(lead => lead.id)]);
            
            // Add lead notifications
            gameEngineResult.newLeads.forEach(leadDef => {
              setPendingNotifications(n => [...n, { 
                type: 'lead', 
                item: leadDef 
              }]);
            });
          }
        }
      }
    } else {
      // Normal processing for non-transition responses
      
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

        // Extract information from character dialogue
        if (speaker !== 'Navarro' && speaker !== detectiveName) {
          const extracted = extractInformationFromDialogue(speaker, obj.text);
          if (extracted.length > 0) {
            setExtractedInformation(prev => {
              const current = prev[speaker] || [];
              const newInfo = extracted.filter(info => !current.includes(info));
              if (newInfo.length > 0) {
                console.log(`🔍 Extracted new information from ${speaker}:`, newInfo);
                return {
                  ...prev,
                  [speaker]: [...current, ...newInfo]
                };
              }
              return prev;
            });
          }
        }

        // Check for dynamic lead generation from NPC dialogue
        if (speaker !== 'Navarro' && speaker !== detectiveName) {
          const dialogueText = obj.text.toLowerCase();
          
          // Check for victim background information
          if (dialogueText.includes('visitor') || dialogueText.includes('came by') || 
              dialogueText.includes('man who') || dialogueText.includes('woman who') ||
              dialogueText.includes('argued') || dialogueText.includes('friend') ||
              dialogueText.includes('relationship') || dialogueText.includes('boyfriend') ||
              dialogueText.includes('girlfriend')) {
            
            // Check if victim-background lead doesn't already exist
            if (!leads.includes('victim-background')) {
              console.log('🎯 Dynamic lead triggered: victim-background');
              
              const victimBackgroundLead = leadDefinitions.find(l => l.id === 'victim-background');
              if (victimBackgroundLead) {
                setLeads(prev => [...prev, 'victim-background']);
                setPendingNotifications(n => [...n, { 
                  type: 'lead', 
                  item: victimBackgroundLead 
                }]);
              }
            }
          }
        }

        // Track the conversation
        trackConversationHistory(
          speaker, 
          obj.text, 
          // Detect if this was a response to a question
          input.includes('?') || 
            input.toLowerCase().startsWith('tell me') || 
            input.toLowerCase().startsWith('what'),
          setConversationState,
          {
            currentTime: fmt(currentClock()),
            timeElapsed: timeElapsed,
            detectiveName: detectiveName,
            evidence: evidence,
            leads: leads
          }
        );
        
        // Analyze and update conversation context for this dialogue (batch all updates)
        if (speaker !== 'Navarro') {
          const topics = extractTopics(obj.text);
          const analysis = analyzeDialogueContext(obj.text, {
            currentTime: fmt(currentClock()),
            detectiveName: detectiveName,
            evidence: evidence,
            leads: leads
          });
          
          // Single batched state update to prevent race conditions
          setConversationStateWithValidation(prev => {
            const character = prev.characters[speaker] || {
              topicsDiscussed: [],
              mood: 'neutral',
              responses: 0,
              suspicionLevel: 0,
              cooperationLevel: 5,
              keyTopics: []
            };
            
            return {
              ...prev,
              characters: {
                ...prev.characters,
                [speaker]: {
                  ...character,
                  topicsDiscussed: [...character.topicsDiscussed, ...topics, ...analysis.topics],
                  mood: analysis.emotionalTone || character.mood,
                  responses: character.responses + 1,
                  keyTopics: [...(character.keyTopics || []), ...analysis.topics]
                }
              }
            };
          });
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
      
      // Scene ending transition handled in main investigative flow now
      
      // Process notifications immediately after dialogue (if any remain)
      if (pendingNotifications.length > 0) {
        processPendingNotifications();
      }
      
      // Conversation ending is now handled by useEffect that watches conversationState changes
    }
  } catch (err) {
    setMsgs(m => [...m, { speaker: 'Navarro', content: `❌ ${err.message}` }]);
  } finally {
    setLoading(false);
    setInput(''); // Clear input field after all processing is done
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
        {displayedMsgs.map((m,i) => (
          <div key={m.id || i} style={{ marginBottom: '8px' }}>
            <strong>{m.speaker}:</strong> {m.displayContent || ''}
            {m.isTyping && <span style={{ opacity: 0.7, marginLeft: '2px', animation: 'blink 1s infinite' }}>|</span>}
          </div>
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
                      {extractedInformation['Marvin Lott'] ? 
                        extractedInformation['Marvin Lott'].map((info, index) => (
                          <li key={index}>{info}</li>
                        )) : 
                        <li>Interview in progress...</li>
                      }
                    </ul>
                  </div>
                )}
                
                {interviewsCompleted.includes('Rachel Kim') && (
                  <div style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <h4 style={{ color: '#000', margin: '0 0 4px 0', fontSize: '1.1rem' }}>Rachel Kim (Best Friend)</h4>
                    <ul style={{ color: '#444', paddingLeft: '20px', margin: '4px 0' }}>
                      {extractedInformation['Rachel Kim'] ? 
                        extractedInformation['Rachel Kim'].map((info, index) => (
                          <li key={index}>{info}</li>
                        )) : 
                        <li>Interview in progress...</li>
                      }
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
                      {extractedInformation['Jordan Valez'] ? 
                        extractedInformation['Jordan Valez'].map((info, index) => (
                          <li key={index}>{info}</li>
                        )) : 
                        <li>Interview in progress...</li>
                      }
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
              <li style={{ marginBottom: '4px' }}><strong>2:00-4:00 AM</strong> - Estimated time of death</li>
              {extractedInformation['Marvin Lott']?.some(info => info.includes('3:30 AM')) && (
                <li style={{ marginBottom: '4px' }}><strong>3:30 AM</strong> - Marvin Lott heard scream</li>
              )}
              {extractedInformation['Marvin Lott']?.some(info => info.includes('furniture moving')) && (
                <li style={{ marginBottom: '4px' }}><strong>~3:30 AM</strong> - Furniture movement heard after scream</li>
              )}
              {extractedInformation['Marvin Lott']?.some(info => info.includes('leave building')) && (
                <li style={{ marginBottom: '4px' }}><strong>~3:45 AM</strong> - Someone seen leaving building</li>
              )}
              {leads.includes('phone-records') && (
                <li style={{ marginBottom: '4px' }}><strong>7:25 AM</strong> - Rachel called Mia's phone (before claimed discovery)</li>
              )}
              {extractedInformation['Rachel Kim']?.some(info => info.includes('8:00 AM')) && (
                <li style={{ marginBottom: '4px' }}><strong>8:00 AM</strong> - Rachel claims to have found body</li>
              )}
              <li style={{ marginBottom: '4px' }}><strong>7:45 AM</strong> - Body discovered (official record)</li>
            </ul>
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
      {/* Debug Tools - only visible during development */}
{process.env.NODE_ENV === 'development' && (
  <div style={{ 
    position: 'fixed', 
    bottom: 10, 
    right: 10, 
    background: '#333', 
    padding: 10,
    borderRadius: 5,
    zIndex: 1000
  }}>
    <div style={{ marginBottom: 5, fontWeight: 'bold', color: '#fff' }}>Debug Tools</div>
    <button 
      onClick={() => console.log('📊 Current Conversation State:', conversationState)}
      style={{ marginRight: 5 }}
    >
      Log State
    </button>
    <button 
      onClick={() => console.log('👥 Character Data:', 
        conversationState.currentCharacter ? 
        conversationState.characters[conversationState.currentCharacter] : 
        'No active character'
      )}
      style={{ marginRight: 5 }}
    >
      Log Character
    </button>
    <button 
      onClick={() => ConversationDebug.checkConversationConsistency(conversationState)}
      style={{ marginRight: 5 }}
    >
      Check Consistency
    </button>
    <div style={{ marginTop: 5 }}>
      <input 
        type="checkbox" 
        id="debugEnabled" 
        checked={ConversationDebug.enabled}
        onChange={e => ConversationDebug.enabled = e.target.checked} 
      />
      <label htmlFor="debugEnabled" style={{ color: '#fff', marginLeft: 5 }}>
        Enable Logging
      </label>
    </div>
  </div>
)}
    </div>
  );
}