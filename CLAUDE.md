# Detective Game Project - "First 48: The Simulation"

## Project Overview
Interactive detective simulation game built with React frontend and OpenAI-powered character dialogue system. Players investigate a murder case by interviewing NPCs, collecting evidence, and analyzing forensic data within a 48-hour time limit.

## Architecture
- **Frontend**: React 18 + Vite (client/)
- **Backend**: Express.js server (server/)
- **AI Proxy**: OpenAI integration (proxy-server.cjs)
- **Game Logic**: Custom game engine (client/src/gameEngine.js)
- **Main App**: App.jsx (4,303 lines - core game controller)

## Key Commands
- **Development**: `npm run dev` (in client/)
- **Build**: `npm run build` (in client/)
- **Lint**: `npm run lint` (check client/package.json for available scripts)
- **Proxy Server**: `node proxy-server.cjs` (from root)

## Current State (Working Features)
- ✅ Crime scene investigation and evidence collection
- ✅ Multi-character conversation system with memory persistence
- ✅ Dr. Sarah Chen forensic analysis system (no hallucinations)
- ✅ Time management with coffee/cigarette break options
- ✅ Evidence board and theory connection system
- ✅ Lead generation and case progression
- ✅ Typewriter effect with Enter-key skip functionality
- ✅ Input clearing race condition resolved

## Major Issues Resolved

### 1. Dr. Chen Hallucination Bug (CRITICAL - FIXED)
**Problem**: Dr. Chen was generating false forensic findings (e.g., "Josh" instead of "Jordan")
**Root Cause**: Missing from character list and no forensic constraints in AI context
**Solution**: 
- Added Dr. Chen to `allCharacters` array in proxy-server.cjs
- Created comprehensive forensic context with exact analysis results
- Added proactive greeting system that mentions ready analysis
- Implemented analysis results sequencing BEFORE AI response

### 2. Input Clearing Race Condition (FIXED)
**Problem**: Text remained in input box after sending, causing duplicate messages when using Enter to skip typewriter
**Solution**: Moved `setInput('')` immediately after capturing input value in `sendMessage` function

### 3. Analysis Results Flow (FIXED)
**Problem**: Analysis completion notifications only showed in sidebar, not feed
**Solution**: Added system messages to feed when analysis completes, enhanced Dr. Chen context awareness

## Key Files and Their Purpose

### Frontend (client/src/)
- **App.jsx**: Main game controller (4,303 lines) - handles all game state, character interactions, evidence system
- **gameEngine.js**: Lead definitions, evidence definitions, action processing, progression logic
- **components/**: React components for UI elements (EvidenceBoard, SimulationCard, etc.)
- **context/GameStateContext.jsx**: React context for game state management

### Backend
- **proxy-server.cjs**: OpenAI integration with character knowledge and conversation management
- **server/index.js**: Basic Express server
- **server/caseData.json**: Case information and suspect data

## Character System
Current NPCs with full dialogue support:
- **Navarro**: Detective partner, provides guidance
- **Marvin Lott**: Neighbor who called 911 (nervous, helpful)
- **Rachel Kim**: Best friend/secret killer (defensive, secretive)
- **Jordan Valez**: Ex-boyfriend (defensive, volatile)
- **Dr. Sarah Chen**: Forensic analyst (professional, precise)

Character types:
- **ASSISTIVE**: Auto-end conversations (Dr. Chen)
- **INVESTIGATIVE**: Need proper conversation closure (suspects)
- **NEUTRAL**: Special handling (Navarro)

## Evidence & Forensics System
Evidence types: bloodstain, stab-wound, no-forced-entry, partial-cleaning, missing-phone, locked-door, bracelet-charm, window-ajar, phone-company-records

Forensic analysis timing:
- Bloodstain: 360 minutes (6 hours)
- Stab-wound: 240 minutes (4 hours)
- Phone records: 180 minutes (3 hours)

## Recent Additions (Interrogation System)

### Rachel Kim Interrogation Implementation (COMPLETED)
### Jordan Valez Interrogation Implementation (COMPLETED)
**Feature**: Full interrogation room system for bringing suspects to police station
**Components Added**:
- **INTERROGATION character type**: New classification for station interrogations vs neighborhood interviews
- **45-minute time cost**: Reflects travel time and formal interrogation setup
- **Accusation detection system**: Detects direct accusations and timeline confrontations
- **Lawyer escalation**: Warning on first accusation, lawyer intervention on second
- **Atmospheric scene setup**: Interrogation room descriptions instead of door knocking
- **Information extraction**: 9 specific response patterns for Rachel's deflection tactics

**Trigger Phrases**: "bring in Rachel", "let's question Rachel", "call in Rachel", etc.
**Evidence Required**: Phone company records OR bracelet DNA analysis
**Location**: App.jsx lines 35-40 (CHARACTER_TYPES), 14-18 (ACTION_COSTS), 1770-1793 (trigger phrases)

### Critical Bug Fix - Variable Redeclaration (RESOLVED)
**Problem**: Added accusation detection code that redeclared existing variables in sendMessage function scope
**Error**: `Cannot redeclare block-scoped variable 'currentCharacter'` and `'currentCharacterType'`
**Root Cause**: Used same variable names (`currentCharacter`, `currentCharacterType`) that already existed lower in the same function
**Solution**: Renamed accusation detection variables to `interrogationCharacter` and `interrogationCharacterType`
**Location**: App.jsx lines 2991-2992 (accusation detection block)
**Lesson**: Always check for existing variable names in function scope before adding new const/let declarations

### Critical Bug Fix - Rachel Interrogation Context Issue (RESOLVED)
**Problem**: Rachel Kim responding like investigation team member instead of suspect during interrogation
**Symptoms**: Rachel saying "That sounds like a good plan. Let's see what she has to say about her call to Mia." instead of "Hi, I don't know what's going on but I can tell something's wrong."
**Root Cause**: proxy-server.cjs had no awareness of INTERROGATION vs INVESTIGATIVE character types
**Missing Context**: 
- No `currentCharacterType` being sent from App.jsx to proxy-server.cjs
- Rachel's character context was identical for neighborhood interviews vs police station interrogations
- No specialized opening behavior for suspects brought to station

**Solution Applied**:
1. **App.jsx**: Added `currentCharacterType: getCharacterType(currentChar)` to gameState payload (line 3516)
2. **proxy-server.cjs**: Added interrogation-specific context detection (`gameState.currentCharacterType === 'INTERROGATION'`)
3. **Character Context Split**: Rachel now has different personality/knowledge for:
   - **INTERROGATION**: Confused suspect at police station, defensive, starts with specific opening line
   - **INVESTIGATIVE**: Regular neighborhood interview context (original behavior)
4. **Opening Line Enforcement**: Forced exact opening "Hi, I don't know what's going on but I can tell something's wrong" for interrogation scenario
5. **Prompt Instructions**: Updated system prompt to handle interrogation room vs door knocking scenarios

**Key Changes**:
- **Line 3516 App.jsx**: Send character type to proxy
- **Lines 233-266 proxy-server.cjs**: Interrogation vs interview context splitting  
- **Lines 317-323 proxy-server.cjs**: Forced opening line for interrogation
- **Lines 527-530 proxy-server.cjs**: Different prompt instructions for interrogation vs neighborhood

**Lesson**: When adding new character interaction modes, ensure the AI backend (proxy-server.cjs) receives proper context about the interaction type, not just the character name. The AI needs to know WHERE the conversation is happening and WHY the character is there.

### Jordan Valez Interrogation Implementation (COMPLETED)
**Feature**: Full interrogation system for red herring suspect with volatile personality
**Trigger System**:
- **Phone records** (primary trigger - same as Rachel)
- **Rachel mentioning Jordan** (secondary trigger - dynamic lead creation when Rachel mentions him during her interrogation)

**Character Differences from Rachel**:
- **Opening**: Defensive/confused "What's going on? Whatever it is you think I did, I didn't!"
- **Death reaction**: Spaced out shock "Oh god... I... I can't believe it"
- **Personality**: Volatile, honest, innocent but knows his history looks bad
- **Evidence defense**: Immediately offers Uber receipt as alibi
- **Counter-accusations**: Points to Rachel as jealous, possessive, "a little nuts"

**Jordan's 3-Stage Volatile Escalation** (differs from Rachel's 2-stage polite escalation):
1. **First accusation**: Explosive outburst "IT WASN'T ME! I was at the bar! I have proof!"
2. **Second accusation**: Lawyer threat "You keep pushing this and I want a lawyer! This is harassment!"
3. **Third accusation**: Lawyer demand "That's it! I'm done! Get me a lawyer NOW!" → Scene ends

**Information Extraction Patterns** (9 patterns):
- Lockwood Bar alibi with 12:05 AM timing
- Uber receipt proof and willingness to provide
- Restraining order explanation (not physical, just escalation)
- Rachel accusations (possessive, jealous, never liked relationship)
- Relationship admissions (rocky but improving)
- Vocal innocence protests
- Shocked death reactions

**Key Implementation Details**:
- **Line 3650-3673 App.jsx**: Dynamic lead creation when Rachel mentions Jordan
- **Lines 268-301 proxy-server.cjs**: Interrogation vs interview context splitting
- **Lines 350-355 proxy-server.cjs**: Forced opening line for interrogation
- **Lines 3041-3071 App.jsx**: 3-stage volatile escalation system

**Character Dynamic**: Rachel and Jordan both accuse each other, creating investigative complexity where both suspects deflect to the other, making it harder for player to identify the real killer.

### Interrogation Flow
1. **Trigger**: Player says "bring Rachel in" after evidence discovery
2. **Navarro**: "I'll have our people bring her in for questioning"
3. **Scene Setup**: Interrogation room atmosphere, Rachel escorted in
4. **Rachel's Opening**: "Hi, I don't know what's going on but I can tell something's wrong"
5. **Natural Conversation**: Evidence-based questions, emotional responses, Jordan deflection
6. **Lawyer System**: Warning → Intervention → Scene end with Navarro commentary

### Key Evidence Responses
- **Phone timeline**: Defensive but maintains 7:25 AM call story
- **Bracelet charm**: "I lost it a while ago, spent lots of time at Mia's"
- **Jordan questions**: Mentions lawsuit/restraining order to deflect suspicion

## Known Issues (Current Priorities)

### 1. Character Detection Over-Sensitivity (MEDIUM)
**Problem**: Mentioning character names in conversation with Navarro triggers unwanted transitions
**Example**: "I wonder what Chen thinks" shouldn't start Chen conversation
**Solution Needed**: Improve `detectCharacterMention` function to differentiate between discussion vs. action intent

### 2. Interview Lead Notes Not Showing (LOW)
**Problem**: Some leads not appearing in detective notepad despite being unlocked
**Log Pattern**: `⚠️ Lead not added to notes: interview-rachel conditions not met`
**Location**: App.jsx lines 1123-1144 (notes processing logic)

## Debugging Patterns

### Character Conversation Issues
1. Check `🎯 Character scores:` logs in console
2. Verify `🔄 [STATE] Conversation state updated` shows correct character
3. Look for `🔧 Continuing conversation with X` vs `🔄 Transitioning from X to Y`

### Dr. Chen Analysis Issues
1. Check `🔬 Analysis completed: Array(1)` indicates ready results
2. Verify `🔬 DEBUG completedAnalysis being sent: Array(1)` shows data flow
3. Look for `📋 Delivering analysis results to user BEFORE AI response`

### Game State Corruption
1. Use browser dev tools: Application → Local Storage → Check `first48_save`
2. Clear with `localStorage.removeItem('first48_save')`
3. Check React dev tools for state inconsistencies

## Development Workflow
1. Make changes in WSL2 Linux environment
2. Sync to Windows with: `rsync -av --exclude 'node_modules' --update ~/sim-platform/ /mnt/c/Users/austi/.vscode/sim-platform/`
3. Test in Windows browser environment
4. Use console logs extensively for debugging character detection and conversation flow

## Common Code Patterns

### Adding New Characters
1. Add to `allCharacters` array in proxy-server.cjs (line ~337)
2. Add character context in `generateConversationContext` function
3. Add character type to `CHARACTER_TYPES` in App.jsx (line ~35)
4. Test conversation flow and ending detection

### Adding New Evidence Types
1. Add to `evidenceDefinitions` array in gameEngine.js
2. Add processing in `getAnalysisResults` function in App.jsx
3. Add to proxy-server.cjs Dr. Chen context if forensic analysis needed
4. Test discovery and analysis flow

## Security Notes
- API keys stored in environment variables
- All evidence and forensic data is hard-coded (no external data sources)
- Character knowledge is completely controlled in codebase
- No user data persistence beyond local storage for save games

## Performance Notes
- App.jsx is large (4,303 lines) but performant due to React's rendering optimizations
- Typewriter effect can be resource-intensive with long messages
- Consider code splitting if file size becomes problematic

## Future Enhancements Needed
- Better character transition intent detection
- More sophisticated conversation memory system
- Additional NPCs and case complexity
- Mobile-responsive design improvements
- Save game cloud synchronization