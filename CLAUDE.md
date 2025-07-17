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