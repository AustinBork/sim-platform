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

## Mobile App Conversion Assessment

### Current Architecture Analysis (Analyzed July 2025)
**Frontend**: React 19.1.0 + Vite 6.3.5 + React Router DOM 7.6.2
**Backend**: Express.js proxy server (proxy-server.cjs) + OpenAI API integration
**Build System**: Vite with modern bundling and hot reload
**State Management**: React Context API (GameStateContext.jsx) + useState hooks
**Styling**: Pure CSS with custom styles (no framework dependencies)

### Mobile Conversion Feasibility: HIGH ⭐⭐⭐⭐⭐

#### Conversion Complexity: LOW to MEDIUM (2-3 weeks PWA, 4-6 weeks native wrapper)

**Architecture Strengths for Mobile**:
- ✅ Modern React foundation with functional components and hooks
- ✅ API-first architecture with clean frontend/backend separation
- ✅ Self-contained game logic in client/src/gameEngine.js
- ✅ JSON-based data storage (no complex database dependencies)
- ✅ Component-based UI structure ready for responsive design
- ✅ Viewport meta tag properly configured
- ✅ Some responsive breakpoints in EvidenceBoard.css

**Current Mobile Limitations**:
- ❌ Desktop-centric UI design (hover states, mouse interactions)
- ❌ No touch gesture handling for evidence board drag-and-drop
- ❌ Text-heavy interfaces designed for larger screens
- ❌ No offline capabilities or service workers
- ❌ No mobile navigation patterns (hamburger menu, bottom tabs)
- ❌ Limited responsive design (only basic @media queries)

### Recommended Conversion Path: Progressive Web App (PWA)

#### Phase 1: PWA Implementation (2-3 weeks)
**Files to Modify/Create**:
- `client/public/manifest.json` - PWA manifest configuration
- `client/public/sw.js` - Service worker for offline functionality
- `client/src/App.css` - Enhanced responsive design
- `client/src/components/EvidenceBoard.jsx` - Touch-friendly interactions
- `client/vite.config.js` - PWA plugin configuration

**Key Changes Needed**:
1. **PWA Configuration**:
   - Add manifest.json with app metadata
   - Implement service worker for caching and offline play
   - Add PWA icons and splash screens

2. **Mobile UI Optimization**:
   - Evidence board: Replace drag-and-drop with tap-to-select
   - Add pinch-to-zoom for evidence connections
   - Implement swipe gestures for navigation
   - Create mobile-friendly card layouts

3. **Navigation Improvements**:
   - Add hamburger menu for mobile
   - Implement bottom navigation tabs
   - Touch-friendly button sizes (44px minimum)
   - Pull-to-refresh functionality

4. **Performance Optimization**:
   - Code splitting for game components
   - Lazy loading for evidence board
   - Asset optimization and compression
   - Bundle size reduction

#### Phase 2: Native Wrapper (Optional, +2-3 weeks)
**Technology**: Capacitor for iOS/Android app store distribution
**Additional Features**: Device camera, push notifications, native performance

### Critical Files for Mobile Conversion

#### UI Components Requiring Mobile Optimization:
- `client/src/components/EvidenceBoard.jsx` - Complex drag-and-drop needs touch redesign
- `client/src/components/SimulationCard.jsx` - Text-heavy cards need mobile layouts
- `client/src/App.jsx` - Main game controller needs responsive state management
- `client/src/App.css` - Primary styling needs comprehensive mobile breakpoints

#### Architecture Files (Minimal Changes):
- `client/src/gameEngine.js` - Game logic works well on mobile (no changes needed)
- `proxy-server.cjs` - Backend API remains unchanged
- `client/src/context/GameStateContext.jsx` - State management works on mobile

### Mobile-Specific Implementation Notes

**Evidence Board Mobile Redesign**:
- Current: SVG-based drag-and-drop with mouse coordinates
- Mobile: Touch-based selection with gesture recognition
- Location: `client/src/components/EvidenceBoard.jsx` lines 200-400 (connection logic)

**Responsive Design Gaps**:
- Current: Only basic `@media (max-width: 768px)` breakpoints
- Needed: Comprehensive mobile-first design system
- Files: All `.css` files, especially `App.css` and component styles

**Performance Considerations**:
- Large bundle size potential (App.jsx is 4,573 lines)
- Real-time AI API calls requiring network connectivity
- Memory-intensive evidence board with SVG connections
- Consider code splitting App.jsx into smaller components

## Enhanced Accusation and Trial System Implementation (July 2025)

### Overview
Implemented complete accusation and trial system with evidence-based dialogue, judge character integration, and proper game ending sequences. System allows players to make formal accusations after 9 PM against interviewed suspects only, triggering an immersive trial sequence.

### Key Features Implemented

#### 1. Enhanced Accusation Modal System
**Location**: App.jsx:4541-4603
**Logic**: Only suspects from `interviewsCompleted` array, filtered to exclude Navarro and Marvin Lott
**UI Elements**:
- Confirmation warnings about game ending consequences
- Dropdown populated with interviewed suspects only
- "Are you sure?" messaging with review reminder
- Cancel option with proper styling

#### 2. Judge Character Integration
**Files Modified**:
- **App.jsx:35-42**: Added Judge to CHARACTER_TYPES as 'TRIAL' type
- **App.jsx:44-52**: Updated getCharacterType() function
- **proxy-server.cjs:519**: Added Judge to allCharacters array
- **proxy-server.cjs:338-354**: Judge character context with formal judicial language

**Character Type**: 'TRIAL' - Hard-coded dialogue for court proceedings only

#### 3. Evidence-Based Trial Dialogue System
**Helper Function**: `formatEvidenceForTrial()` (App.jsx:134-186)
**Evidence Mapping**:
- Physical evidence IDs converted to readable descriptions
- Completed analysis results integrated into trial dialogue
- Dynamic evidence listing based on player's actual investigation

**Evidence Types Supported**:
- bloodstain → "blood spatter analysis"
- bracelet-charm → "bracelet charm found under the couch"
- phone-company-records → "phone company records showing suspicious call timing"
- partial-cleaning → "evidence of attempted crime scene cleanup"
- And 6 additional evidence types with specific descriptions

#### 4. Complete Trial Flow Implementation
**Location**: App.jsx:4029-4086 (submitAccusation function)
**Sequence**:
1. **Accusation Phase**: Navarro presents case with formatted evidence
2. **Trial Phase**: System narration about court proceedings (3-second delay)
3. **Verdict Phase**: Judge delivers formal verdict with proper legal language
4. **Ending Phase**: Navarro gives win/lose response (2-second delay)

**Verdict Logic**: Rachel Kim = GUILTY, all others = NOT GUILTY

#### 5. Game End Screen System
**Location**: App.jsx:4688-4775
**Win Screen Features**:
- Congratulations messaging
- Encouragement to try different approaches
- "Bad cop playthrough" suggestion with emoji
- Start New Case button (localStorage clear + page refresh)

**Lose Screen Features**:
- "Killer got away" messaging
- Motivational retry messaging
- Same restart functionality

**Future-Ready**: Resume from Save button placeholder for multiple save slots

#### 6. State Management Integration
**New State Variables** (App.jsx:428-434):
- `trialInProgress`: Boolean flag for trial sequence
- `trialPhase`: 'NONE', 'ACCUSATION', 'TRIAL', 'VERDICT', 'ENDED'
- `accusedSuspect`: Name of accused suspect
- `showTrialContinue`: Continue button visibility
- `showGameEndScreen`: End screen visibility
- `gameEndType`: 'WIN' or 'LOSE'

**Save/Load Integration**:
- All trial state variables added to saveGame() function (App.jsx:2207-2238)
- Proper state restoration in loadGame() function (App.jsx:2277-2283)

#### 7. User Experience Enhancements
**Input Disabling**: Input field and Send button disabled during trial sequence
**Continue Button**: Styled floating button appears after trial completion
**Timing**: Proper dialogue pacing with setTimeout delays for immersion

### Technical Implementation Strategy

#### Character System Integration
- Leveraged existing CHARACTER_TYPES system rather than creating new architecture
- Judge character uses same conversation flow as other NPCs
- Hard-coded responses prevent AI hallucination during critical trial moments

#### Evidence Integration Approach
- Used existing evidence, completedAnalysis, and extractedInformation state
- Created mapping system for evidence ID to human-readable descriptions
- Maintained compatibility with existing evidence discovery system

#### Trial Flow Architecture
- Sequential setTimeout calls for proper dialogue pacing
- State machine approach with trialPhase tracking
- Conversation state management for character transitions
- Input blocking during automated sequences

### Code Architecture Decisions

#### Why Judge as Character Type vs. System Messages
- **Pros**: Integrates with existing conversation feed system
- **Cons**: Requires proxy-server.cjs modifications
- **Decision**: Used character type for consistency with game's dialogue system

#### Evidence Formatting Strategy
- **Approach**: Switch statement mapping IDs to descriptions
- **Benefit**: Maintainable and extensible for future evidence types
- **Location**: formatEvidenceForTrial() helper function

#### State Management Pattern
- **Pattern**: Added trial state variables alongside existing game state
- **Integration**: Full save/load compatibility maintained
- **Future-Proof**: Easy to extend for more complex trial features

### Testing Checklist
1. **Prerequisites**: Play until 9 PM to unlock accusation button
2. **Suspect Pool**: Interview Rachel Kim and/or Jordan Valez
3. **Accusation Modal**: Verify only interviewed suspects appear
4. **Trial Sequence**: Test evidence-based dialogue generation
5. **Win Condition**: Accuse Rachel Kim → GUILTY verdict
6. **Lose Condition**: Accuse others → NOT GUILTY verdict
7. **End Screens**: Verify proper messaging and restart functionality

### Performance Considerations
- **Trial Sequence**: Uses setTimeout for timing, doesn't block UI
- **Evidence Processing**: O(n) complexity for evidence formatting
- **State Updates**: Batched state changes to prevent render thrashing
- **Memory**: Trial state variables are minimal overhead

### Future Enhancement Opportunities
- **Multiple Save Slots**: Resume from Save button ready for implementation
- **Advanced Verdicts**: Different verdict types based on evidence quality
- **Jury System**: Multiple character responses during trial
- **Appeal Process**: Second chance mechanism for wrong accusations
- **Evidence Presentation**: Visual evidence display during trial

### Lessons Learned
1. **Character Integration**: Existing conversation system handles new character types well
2. **State Management**: Trial state fits naturally into existing save system
3. **Evidence Mapping**: String-based evidence IDs need human-readable conversion
4. **Timing**: setTimeout delays crucial for immersive dialogue pacing
5. **Input Handling**: Blocking user input during automated sequences prevents confusion

## Mini-Map Location System Implementation (July 2025)

### Overview
Implemented interactive mini-map UI element positioned on the left side of the game interface. Provides spatial awareness of key case locations with dynamic location tracking based on character interactions and game state. Features progressive unlocking of suspect locations and filler locations to hide actual suspect count.

### Key Features Implemented

#### 1. Dynamic Location Detection System
**Location**: App.jsx:188-242 (getCurrentLocation function)
**Logic**: Location determined by current character, trial phase, and player actions
**Location Mapping**:
- **Crime Scene**: Default start, crime scene actions (search/photograph), Navarro conversations
- **Marvin's Apartment**: When talking to Marvin Lott
- **Detective HQ**: Dr. Chen conversations, interrogations (Rachel/Jordan), trial preparation
- **Rachel's House**: Only visible after Rachel interviewed (unlocked)
- **Jordan's House**: Only visible after Jordan interviewed (unlocked)
- **Courtroom**: Appears during trial sequence (trialPhase !== 'NONE')

#### 2. Progressive Location Unlocking
**Logic**: `interviewsCompleted.includes()` checks for character access
**Implementation**: App.jsx:4361-4377 (conditional rendering)
**Features**:
- Suspect houses only appear after character interviews
- Maintains investigation mystery by hiding total suspect count
- Filler locations provide red herrings

#### 3. Visual Design System
**Location**: App.css:434-521 (mini-map styles)
**Design Elements**:
- **Noir Theme**: Dark grays (#1a1a1a, #2a2a2a) matching existing detective aesthetic
- **Current Location Indicator**: Red pulsing dot (●) with CSS animation
- **Icons**: 🏚️ Crime Scene, 🚪 Marvin's, 🕵️ Detective HQ, 🏠 Houses, ⚖️ Courtroom
- **Interactive States**: Hover effects, current location highlighting (#2d4a2d green)

#### 4. Layout Integration
**Container Modification**: App.jsx:4333 (game-container flex layout)
**Structure**:
- Main container expanded to 1200px width
- Mini-map fixed 200px width on left side
- Main game area flex: 1 (responsive)
- 16px gap between mini-map and game content

#### 5. State Management Integration
**New State Variable**: `currentLocation` (App.jsx:437)
**Location Tracking**: useEffect hook (App.jsx:1301-1307)
**Save/Load Integration**:
- Added to saveGame() function (App.jsx:2302)
- Restored in loadGame() function (App.jsx:2352)
- Default location: 'crime-scene'

### Technical Implementation Strategy

#### Location Detection Logic
```javascript
// Character-based location priority
if (currentCharacter === 'Marvin Lott') return 'marvin-apartment';
if (currentCharacter === 'Dr. Sarah Chen') return 'detective-hq';
if (currentCharacter === 'Rachel Kim') {
  return characterType === 'INTERROGATION' ? 'detective-hq' : 'rachel-house';
}
// Action-based fallback for crime scene activities
if (lastAction.includes('search') || lastAction.includes('photograph')) {
  return 'crime-scene';
}
```

#### Progressive Unlocking Pattern
```javascript
// Only show if character unlocked via interviews
{interviewsCompleted.includes('Rachel Kim') && (
  <div className="location rachel-house">
    <span className="location-icon">🏠</span>
    <span className="location-title">Rachel's House</span>
  </div>
)}
```

#### Visual State Management
```javascript
// Dynamic CSS classes and indicators
<div className={`location ${currentLocation === 'crime-scene' ? 'current' : ''}`}>
  {currentLocation === 'crime-scene' && <span className="location-indicator">●</span>}
</div>
```

### Code Architecture Decisions

#### Why Left Side Placement vs. Right Side
- **Pros**: Doesn't interfere with existing UI elements
- **Cons**: Required container layout modification
- **Decision**: Left placement maintains chat feed prominence while adding spatial context

#### Location State Management Approach
- **Pattern**: Single currentLocation state with computed updates
- **Integration**: Full save/load compatibility maintained
- **Performance**: useEffect with proper dependencies prevents unnecessary updates

#### Conditional Rendering Strategy
- **Approach**: JavaScript conditional rendering in JSX
- **Benefit**: Progressive disclosure based on game progress
- **Maintainability**: Easy to add new locations or modify unlock conditions

### Visual Design Implementation

#### CSS Architecture
```css
.mini-map {
  width: 200px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  /* Detective noir theme colors */
}

.location.current {
  background: #2d4a2d;
  border-color: #4a7a4a;
  color: #90ee90;
  /* Green highlight for current location */
}

.location-indicator {
  color: #ff4444;
  animation: pulse 2s infinite;
  /* Animated red dot for current position */
}
```

#### Icon Selection Strategy
- **Crime Scene**: 🏚️ (damaged building suggests crime)
- **Marvin's Apartment**: 🚪 (door represents neighbor access)
- **Detective HQ**: 🕵️ (detective emoji for police work)
- **Houses**: 🏠 (standard residential)
- **Courtroom**: ⚖️ (scales of justice)

### Integration Points

#### Character System Integration
- Leverages existing `conversationState.currentCharacter`
- Uses `getCharacterType()` for interrogation vs interview distinction
- Connects to `interviewsCompleted` array for progressive unlocking

#### Trial System Integration
- Responds to `trialPhase` state changes
- Courtroom location appears during trial sequence
- Maintains location context during automated trial dialogue

#### Save System Integration
- Location state preserved across save/load cycles
- Default restoration to 'crime-scene' if save corrupted
- Compatible with existing save structure

### Performance Considerations
- **Location Updates**: O(1) lookup with simple string comparisons
- **Rendering**: Conditional rendering prevents unnecessary DOM elements
- **CSS Animations**: Hardware-accelerated pulse animation for location indicator
- **State Management**: Single location state prevents render thrashing

### Future Enhancement Opportunities
- **Click Navigation**: Add click handlers for quick location switching
- **Location History**: Track visited locations with visual indicators
- **Distance/Travel Time**: Add realistic travel mechanics between locations
- **Location-Specific Actions**: Context-sensitive actions per location
- **Map Zoom**: Expandable detailed view of specific areas

### Testing Integration Points
1. **Character Conversations**: Verify location updates when switching characters
2. **Action-Based Detection**: Test crime scene activities trigger correct location
3. **Progressive Unlocking**: Confirm suspect locations appear after interviews
4. **Trial Sequence**: Validate courtroom location during trial phases
5. **Save/Load**: Ensure location state persists across game sessions

### Lessons Learned
1. **Layout Flexibility**: Existing game container accommodated mini-map without major restructuring
2. **State Integration**: Location tracking fits naturally into existing game state patterns
3. **Progressive Disclosure**: Conditional rendering provides effective mystery preservation
4. **Visual Feedback**: Animated indicators crucial for immediate location awareness
5. **CSS Theming**: Consistent color scheme integration maintains aesthetic cohesion

## SVG Visual Map Upgrade (July 2025)

### Overview
Upgraded the mini-map from a simple list-based interface to a detailed 2D overhead visual map using SVG. This change transforms the spatial awareness experience from abstract location names to an actual detective case map with realistic building layouts, streets, and neighborhood context.

### Why the Change Was Made
**User Feedback**: "I was kinda hoping for less of a list and more of an actual visual map"
**Problem**: Original list-based mini-map felt abstract and didn't provide genuine spatial context
**Solution**: Create authentic 2D overhead view that looks like a real detective case map

### Implementation Changes

#### 1. Visual Design Transformation
**From**: List of location cards with icons and text
**To**: SVG-based overhead neighborhood map with detailed buildings
**Location**: Replaced App.jsx:4334-4457 list structure with SVG map

**Building Design Details**:
- **Crime Scene**: Multi-unit apartment complex (40×25px) with individual windows
- **Marvin's Apartment**: Adjacent smaller building (25×25px) with door detail
- **Detective HQ**: Large institutional building (50×30px) with grid windows and entrance
- **Rachel's House**: Residential with triangular roof and front entrance
- **Jordan's House**: Larger house with peaked roof and garage area
- **Courthouse**: Grand building with columns and formal architecture

#### 2. Size and Layout Optimization
**Size Change**: Expanded from 200px to 320px × 400px
**Reason**: Utilize available left sidebar space for more detailed map
**Layout**: SVG viewBox="0 0 300 320" for optimal scaling and detail

#### 3. Street and Road System
**Addition**: Grid-based road network connecting all locations
**Implementation**: 
```svg
<path className="map-road" d="M 0 80 L 300 80" />
<path className="map-road" d="M 80 0 L 80 320" />
```
**Purpose**: Provides realistic neighborhood structure and navigation context

#### 4. Ambient Environment Enhancement
**Addition**: 13 scattered filler buildings throughout map
**Positioning**: Random placement to create organic neighborhood feel
**Styling**: Muted colors (#1f1f1f) with reduced opacity (0.6)
**Purpose**: Hide actual suspect count and create realistic urban environment

#### 5. Enhanced Location Indication System
**Visual Upgrade**: Red pulsing dot positioned precisely on buildings
**Building Highlighting**: Green (#2d4a2d) background for current location
**Label Enhancement**: Text labels positioned above buildings with current highlighting

#### 6. CSS Architecture Expansion
**New Styles Added** (App.css:523-587):
```css
.map-svg { /* SVG container styling */ }
.map-building { /* Building base styles with hover effects */ }
.map-building.current-location { /* Active location highlighting */ }
.map-building.unlocked { /* Unlocked suspect locations */ }
.map-building.filler { /* Ambient environment buildings */ }
.map-road { /* Street and road styling */ }
.map-location-dot { /* Animated position indicator */ }
.map-label { /* Building labels and current highlighting */ }
```

### Technical Implementation Strategy

#### SVG vs Canvas Decision
**Chosen**: SVG for scalability, interactivity, and CSS integration
**Benefits**: 
- Vector graphics scale perfectly at any size
- Easy CSS styling and hover effects
- Future click handlers simple to implement
- Integrates naturally with existing DOM structure

#### Progressive Disclosure Preservation
**Maintained**: All existing conditional rendering logic
**Enhanced**: Visual appearance but same functional behavior
```javascript
{interviewsCompleted.includes('Rachel Kim') && (
  <g>
    <rect className="map-building unlocked" />
    <text className="map-label">Rachel's</text>
  </g>
)}
```

#### Coordinate System Design
**Strategy**: Fixed coordinate system (300×320) with relative positioning
**Building Placement**: Scattered naturally across map quadrants
**Road Grid**: Consistent spacing for realistic street layout

### User Experience Improvements

#### Spatial Context Enhancement
**Before**: Abstract list of location names
**After**: Visual neighborhood with relative positioning
**Benefit**: Players can understand geographic relationships between locations

#### Immersion Upgrade
**Before**: Game UI element feel
**After**: Authentic detective case map appearance
**Benefit**: Reinforces noir detective theme and investigation atmosphere

#### Mystery Preservation
**Enhanced**: Filler buildings create more convincing neighborhood
**Strategic**: Random building placement hides actual suspect locations
**Benefit**: Players can't deduce suspect count from map layout

### Performance Considerations
**SVG Rendering**: Lightweight vector graphics with hardware acceleration
**CSS Animations**: Efficient pulse animation using CSS transforms
**Conditional Rendering**: Same efficient React patterns maintained
**Memory Impact**: Minimal - SVG elements are lightweight DOM nodes

### Integration Maintenance
**Location Detection**: All existing getCurrentLocation() logic preserved
**State Management**: No changes to currentLocation state handling
**Save/Load**: Fully compatible with existing save system
**Progressive Unlocking**: Identical behavior with enhanced visual feedback

### Future Enhancement Opportunities
**Click Navigation**: SVG buildings ready for click handlers
**Path Animation**: Red dot could animate along roads when moving
**Map Zoom**: SVG scales perfectly for detailed/overview modes
**Building Details**: Easy to add more architectural elements
**Dynamic Elements**: Weather, time-of-day lighting effects possible

### Design Philosophy
**Authenticity**: Map looks like actual detective case board
**Functionality First**: Visual upgrade preserves all existing features
**Noir Aesthetic**: Dark colors and architectural style match game theme
**User-Centered**: Responds directly to user feedback for better spatial awareness

### Lessons Learned
1. **SVG Flexibility**: Vector graphics ideal for game map interfaces
2. **Visual Context**: Spatial relationships significantly improve user understanding
3. **Progressive Enhancement**: Visual upgrades can maintain functional behavior
4. **User Feedback Integration**: Direct response to user preferences improves engagement
5. **Thematic Consistency**: Visual elements should reinforce overall game aesthetic

## SVG Map Refinements and Detail Enhancement (July 2025)

### Overview
Applied targeted adjustments to the SVG map based on user feedback to resolve label overlaps, improve spatial organization, and enhance visual consistency. Added architectural details to all buildings to create a more immersive and professional neighborhood appearance.

### Specific Issues Addressed
**User Feedback**: "marvin name and crime scene overlap simply move marvins to below the building. also move the detective hq down one column. adds space. looks good. other building should have detail as well even tho there un named. should all pop. make sense? i also dont see court room."

### Implementation Changes

#### 1. Label Positioning Fix
**Problem**: Marvin's label overlapped with Crime Scene label
**Solution**: Moved Marvin's label from above building (y="45") to below (y="85")
**Location**: App.jsx:4471
**Result**: Clear visual separation, no text overlap

#### 2. Spatial Organization Improvement
**Detective HQ Repositioning**:
- **From**: x="85" (same column as Crime Scene)
- **To**: x="165" (moved one column right)
- **Benefit**: Better spatial distribution, reduced visual crowding
- **Location**: App.jsx:4479

#### 3. Courtroom Visibility Enhancement
**Problem**: Courtroom was positioned at bottom of map, sometimes off-screen
**Solution**: Moved to column below Detective HQ (x="165" y="200")
**Location**: App.jsx:4529
**Result**: Courtroom now prominently visible during trial sequences

#### 4. Comprehensive Building Detail Enhancement
**Problem**: Filler buildings lacked architectural character
**Solution**: Added detailed architectural elements to all 12 filler buildings

**Architectural Details Added**:
- **Windows**: Individual window frames (4×5px to 6×7px) on every building
- **Doors**: Front entrances and garage doors (6×3px to 12×3px)
- **Roofs**: Triangular peaked roofs on residential buildings using polygon elements
- **Multi-story Elements**: Grid window patterns for larger buildings
- **Variety**: Different building heights, window configurations, and architectural styles

**Example Implementation**:
```svg
<g>
  <rect className="map-building filler" x="45" y="15" width="20" height="30" rx="2" />
  <rect x="48" y="18" width="3" height="4" fill="#111" />  <!-- Window 1 -->
  <rect x="53" y="18" width="3" height="4" fill="#111" />  <!-- Window 2 -->
  <rect x="58" y="18" width="3" height="4" fill="#111" />  <!-- Window 3 -->
  <rect x="48" y="25" width="3" height="4" fill="#111" />  <!-- Window 4 -->
  <rect x="53" y="25" width="3" height="4" fill="#111" />  <!-- Window 5 -->
  <rect x="58" y="25" width="3" height="4" fill="#111" />  <!-- Window 6 -->
  <rect x="52" y="40" width="6" height="3" fill="#333" />  <!-- Door -->
</g>
```

#### 5. Visual Consistency Improvements
**Standardized Elements**:
- **Window Colors**: Consistent #111 for all window interiors
- **Door Colors**: #333 for all entrance doors
- **Roof Colors**: #333 for triangular roof elements
- **Proportions**: Scaled details appropriately to building sizes

### User Experience Impact

#### Spatial Clarity
**Before**: Overlapping labels, crowded column layout
**After**: Clear label positioning, distributed spatial organization
**Benefit**: Easier navigation and location identification

#### Visual Immersion
**Before**: Plain rectangular filler buildings
**After**: Detailed architectural elements on every structure
**Benefit**: Realistic neighborhood appearance, enhanced detective theme

#### Functional Visibility
**Before**: Courtroom sometimes invisible or poorly positioned
**After**: Prominent placement in logical spatial relationship to Detective HQ
**Benefit**: Clear trial sequence visualization

### Technical Implementation Details

#### Grouping Strategy
**Pattern**: Each building wrapped in `<g>` tags for logical organization
**Benefit**: Easy modification and maintenance of building components
**Structure**: Main building rect + detail elements (windows/doors/roofs)

#### Coordinate System Optimization
**Detective HQ**: Moved from column 1 (x=85) to column 2 (x=165)
**Courtroom**: Positioned in column 2, row 3 (x=165, y=200)
**Spacing**: Maintained 80px column spacing for consistent grid alignment

#### Detail Scaling
**Small Buildings**: 2-4 windows, simple door
**Medium Buildings**: 4-6 windows, detailed entrance
**Large Buildings**: 6+ windows in grid pattern, commercial-style doors
**Proportional**: Window and door sizes scaled to building dimensions

### Performance Considerations
**SVG Elements**: Added ~36 detail elements (3 per filler building × 12 buildings)
**Rendering Impact**: Minimal - simple geometric shapes with efficient CSS
**Memory Usage**: Negligible increase in DOM node count
**Animation**: No impact on existing pulse animation performance

### Design Philosophy Reinforcement
**Attention to Detail**: Every building contributes to neighborhood authenticity
**User-Responsive**: Direct implementation of specific user feedback
**Functional Beauty**: Enhanced visuals support gameplay immersion
**Systematic Approach**: Consistent architectural elements across all structures

### Quality Assurance Validation
✅ **Label Overlap**: Resolved - Marvin's label now clearly separated
✅ **Spatial Distribution**: Improved - Detective HQ repositioned for better flow
✅ **Courtroom Visibility**: Enhanced - Prominent placement during trials
✅ **Building Details**: Complete - All 12 filler buildings have architectural character
✅ **Visual Consistency**: Maintained - Consistent color scheme and proportions

### Future Enhancement Opportunities
**Advanced Details**: Street lights, trees, parking areas
**Dynamic Elements**: Day/night lighting, weather effects
**Interactive Features**: Building hover information, click navigation
**Architectural Variety**: Different building styles (Victorian, modern, industrial)
**Environmental Context**: Parks, commercial districts, residential zones

### Lessons Learned
1. **User Feedback Precision**: Specific positioning feedback leads to immediate UX improvements
2. **Visual Hierarchy**: Proper spacing prevents cognitive overload in dense interfaces
3. **Detail Consistency**: Uniform architectural elements create professional appearance
4. **Functional Positioning**: Key locations should be prominently placed for gameplay clarity
5. **Iterative Enhancement**: Small adjustments can significantly improve overall experience

### Future Enhancements Needed
- Better character transition intent detection
- More sophisticated conversation memory system
- Additional NPCs and case complexity
- Save game cloud synchronization
- Multiple save slot system (foundation already implemented)
- Click-to-navigate functionality for mini-map locations
- Path animation for location transitions
- Map zoom functionality for detailed building views
- Advanced architectural theming for different neighborhood districts

## Critical Dialogue System Bugs (January 2025)

### Overview
Multiple critical failures discovered during Rachel/Jordan interrogation sequence playthrough. These bugs affect core dialogue system functionality, character detection, state management, and user experience. Priority repair needed for production stability.

### BUG #1: Character Detection Misfire (CRITICAL - UNRESOLVED)
**Problem**: Asking Jordan "what do you know about rachel?" incorrectly triggers character transition to Rachel instead of continuing Jordan conversation
**Symptoms**: 
- User asks Jordan about Rachel's behavior
- System detects "Rachel Kim with score 10" 
- Unwanted transition: "Transitioning from Jordan Valez to Rachel Kim"
- Interrogation flow completely broken

**Root Cause**: Character detection system treats ANY mention of character name as transition intent
**Location**: App.jsx:1765-1941 (detectCharacterMention function)
**Evidence**: 
```javascript
App.jsx:1937 ✅ Detected Rachel Kim with score 10
App.jsx:3143 🔄 Transitioning from Jordan Valez to Rachel Kim
```

**Solution Needed**: Context-aware detection to distinguish "ask about X" vs "talk to X"
```javascript
// Proposed fix in detectCharacterMention
function detectCharacterMention(text, currentCharacter) {
  if (currentCharacter && isAskingAboutSomeone(text)) {
    return null; // Don't transition when asking ABOUT someone
  }
  // Existing scoring logic...
}
```

### BUG #2: JSON Response Corruption (CRITICAL - UNRESOLVED)
**Problem**: Malformed dialogue JSON with duplicate text fields causing parsing failures
**Symptoms**: `"","text":"Oh my God! No, not Mia! What happened? I just saw her yesterday!"}"`
**Root Cause**: Response formatting issues in proxy-server.cjs during AI response generation
**Location**: proxy-server.cjs:600-747 (response generation and parsing)
**Impact**: Broken dialogue display, potential UI corruption

**Solution Needed**: Response validation and cleanup before sending to client
- Add JSON structure validation
- Implement response sanitization
- Add fallback for malformed responses

### BUG #3: sendMessage Infinite Loop (CRITICAL - RESOLVED)
**Problem**: 15+ consecutive sendMessage calls creating race conditions and performance issues
**Evidence**: Console shows `🚀 Starting sendMessage with current state: Object` repeated 15+ times
**Root Cause**: No call deduplication, rate limiting, or processing state management
**Location**: App.jsx:2999 (sendMessage function)
**Impact**: Browser performance degradation, potential freeze, API rate limiting

**Solution Implemented**: Added processing state guard with proper flag management
```javascript
// IMPLEMENTED FIX in App.jsx:450, 3153-3161, 4112-4113
const [isProcessingMessage, setIsProcessingMessage] = useState(false);

// In sendMessage function:
if (isProcessingMessage) {
  console.log('⚠️ sendMessage already in progress, skipping to prevent infinite loop');
  return;
}
setIsProcessingMessage(true);

// In finally block:
setIsProcessingMessage(false);
console.log('✅ sendMessage processing complete, flag cleared');
```

**Verification**: 
- ✅ State variable added: `isProcessingMessage` 
- ✅ Early return guard prevents concurrent calls
- ✅ Flag properly set and cleared in try/finally block
- ✅ Console logging for debugging verification
- ✅ Infinite loop condition eliminated

**Implementation Errors Fixed**: 

**Error #1 - Syntax Issue:**
- ❌ **Initial Error**: Added extra `try {` block at line 3166, creating nested try blocks
- ✅ **Resolution**: Removed redundant try block - existing try-catch at line 3610 was sufficient
- 🔍 **Lesson**: Always check for existing try-catch structures before adding new ones
- 📋 **Future Check**: Search for existing `try {` patterns before implementing new error handling

**Error #2 - Processing Flag Scope (CRITICAL):**
- ❌ **Critical Error**: Set `setIsProcessingMessage(true)` at line 3161, before try block at line 3605
- 🚨 **Impact**: 400+ lines of code between flag set and try block with potential early returns
- 💥 **Result**: Flag never cleared if early return occurred, permanently locking message system
- ✅ **Resolution**: Moved `setIsProcessingMessage(true)` INSIDE try block at line 3607
- 🔧 **Root Cause**: Misunderstanding of try-finally scope - flag must be set where finally can clear it
- 🔍 **Lesson**: Processing flags must be set INSIDE try blocks, not before them
- 📋 **Future Check**: Ensure state flags are set within the same try-finally scope where they're cleared

### BUG #4: Character Attribution Confusion (HIGH - RESOLVED)
**Problem**: Characters speaking dialogue intended for other characters or system
**Symptoms**: Rachel saying "in for questioning. Let's see what she has to say..." (should be Navarro/system)
**Root Cause**: AI completely ignoring complex prompt structure with nested conditionals
**Location**: proxy-server.cjs:550-602 (systemPrompt construction)
**Impact**: ALL character context was being ignored since project start

**Critical Discovery**: The AI was rejecting the entire complex prompt structure, causing:
- ❌ All character context to be ignored (Dr. Chen, Rachel, Jordan, etc.)
- ❌ JSON format requirements ignored (returned plain text)
- ❌ Character personality traits ignored
- ❌ Forensic constraints ignored
- ❌ Character knowledge completely ignored

**Evidence of Problem**:
```
🔴 RAW MODEL OUTPUT: Let's get those phone records submitted...  // Plain text
📝 No JSON found, using enhanced natural text parsing              // Format ignored
```

**Solution Implemented**: Completely rebuilt prompt structure
```javascript
// OLD (broken): Complex nested conditionals with 600+ lines
const systemPrompt = `Complex nested structure with ${gameState.pendingAction === 'MOVE_TO_CHARACTER' ? 
  (gameState.currentCharacterType === 'INTERROGATION' ? 
    'nested conditional' : 'more nesting') : 'even more complexity'}`;

// NEW (working): Simple, direct structure  
const systemPrompt = `You are ${suggestedSpeaker} in "First 48: The Simulation."
${conversationContext}
RESPONSE FORMAT: {"type":"dialogue","speaker":"${suggestedSpeaker}","text":"response"}`;
```

**Results After Fix**:
```
🔴 RAW MODEL OUTPUT: {"type":"dialogue","speaker":"Dr. Sarah Chen","text":"..."}  // Proper JSON
🧩 Final processed response objects: [...]                                        // Format followed
```

**Verification**: 
- ✅ AI now follows JSON format requirements
- ✅ Character context processing restored
- ✅ Dr. Chen follows forensic protocols  
- ✅ Characters stay in assigned roles
- ✅ All detailed character work now functional

### BUG #4.2: Dr. Chen Hallucination Regression (HIGH - RESOLVED)
**Problem**: Prompt simplification accidentally removed anti-hallucination constraints
**Symptoms**: Dr. Chen inventing "Jake Miller," fictional call times, made-up contacts
**Root Cause**: Simplified prompt removed forensic constraints that prevented hallucinations
**Impact**: Dr. Chen hallucinating again despite having correct analysis results

**What Was Lost in Simplification**:
- 🚨 Forensic constraints that prevent hallucination
- 📋 Explicit prohibitions against inventing names/details
- ⚠️ Requirements to reference only actual System message results

**Evidence of Regression**:
```
Dr. Sarah Chen: "The analysis shows Jake Miller called at 2:45 AM..."  // HALLUCINATION
// Should be: "Rachel Kim called at 7:25 AM" (actual analysis result)
```

**Solution Applied**: Re-added strengthened anti-hallucination constraints
```javascript
// Added back to character context:
🚨 CRITICAL FORENSIC CONSTRAINTS - NEVER VIOLATE THESE:
- You can ONLY discuss analysis results from System messages starting with "🔬 Analysis Result:"
- NEVER mention names, times, or details not in actual analysis results
- DO NOT create fictional contact names, call times, or investigation details
- NEVER say "Jake Miller" or any name not in official analysis results

// Added to main prompt:
${suggestedSpeaker === 'Dr. Sarah Chen' ? `
🚨 ABSOLUTE RULE FOR DR. CHEN: NEVER HALLUCINATE FORENSIC FINDINGS
- Only reference analysis results that appear as System messages
- Never invent names like "Jake Miller" or fictional contact details
- Stick EXACTLY to the provided analysis results
` : ''}
```

**Implementation Strategy**: Double-layer protection
1. **Character Context Level**: Forensic constraints in generateConversationContext()
2. **Main Prompt Level**: Additional Dr. Chen-specific anti-hallucination rules

**Verification**:
- ✅ Dr. Chen references only actual analysis results
- ✅ No more fictional character names (Jake Miller eliminated)
- ✅ Exact adherence to System message forensic findings
- ✅ Maintains simplified prompt benefits without hallucination regression

### BUG #5: State Synchronization Failure (HIGH - UNRESOLVED)
**Problem**: Async state updates causing conflicting character states
**Evidence**: 
```
🔄 Transitioning from Jordan Valez to Rachel Kim
🔧 Continuing conversation with Jordan Valez  // Contradiction
```
**Root Cause**: Race conditions between character transition and conversation continuation logic
**Location**: App.jsx:3143, 3430 (transition and continuation logic)
**Impact**: Unpredictable character behavior, conversation state corruption

**Solution Needed**: Proper async state coordination with transition locks

### BUG #6: Lead Notes System Failures (MEDIUM - UNRESOLVED)
**Problem**: Investigation leads not appearing in detective notepad despite being unlocked
**Symptoms**: Multiple `⚠️ Lead not added to notes: [lead-name] conditions not met` warnings
**Affected Leads**: interview-marvin, apartment-search, interview-jordan, victim-background
**Location**: App.jsx:1152 (lead condition checking)
**Impact**: Players missing important investigation guidance

**Investigation Needed**: Audit lead condition logic and requirements

### BUG #7: Character Transition Fallback Triggered (MEDIUM - UNRESOLVED)
**Problem**: System falling back to immersive suggestions during failed character transitions
**Evidence**: `⚠️ No response from Rachel Kim during transition. Adding immersive fallback.`
**Location**: App.jsx:3634
**Impact**: Poor user experience, breaks conversation immersion

## Priority Repair Plan

### Phase 1 - Critical Fixes (Week 1)
1. **Character Detection Context Awareness**: Fix over-sensitive character mention detection
2. **sendMessage Debouncing**: Prevent infinite loop conditions
3. **JSON Response Validation**: Fix malformed dialogue responses

### Phase 2 - Stability Improvements (Week 2)
4. **Character Attribution**: Fix dialogue speaker confusion
5. **State Synchronization**: Implement proper async coordination
6. **Lead Notes System**: Audit and repair condition checking

### Phase 3 - Architecture Improvements (Weeks 3-4)
7. **Dialogue Controller Extraction**: Break up monolithic App.jsx
8. **Conversation State Machine**: Implement proper state management
9. **Error Recovery**: Add graceful degradation mechanisms

## Debug Monitoring Recommendations

### Add Instrumentation
```javascript
// Character detection validation
ConversationDebug.logTransition(from, to, `Intent: ${userIntent}`);

// State corruption detection  
ConversationDebug.validateStateTransition(prevState, newState);

// Performance monitoring
ConversationDebug.logPerformance('sendMessage', executionTime);
```

### Error Boundaries
- Wrap dialogue components in React Error Boundaries
- Graceful degradation for AI API failures  
- State recovery mechanisms for corrupted conversations

## Technical Debt Assessment

### Monolithic Controller Issues
- **App.jsx**: 4,303 lines handling ALL dialogue logic
- **Multiple Responsibilities**: Character detection, state management, UI updates, API calls
- **Testing Difficulty**: Impossible to unit test individual components

### State Management Fragility  
- **15+ interdependent state variables**
- **No state validation middleware**
- **Async update coordination issues**
- **Race condition vulnerabilities**

## Lessons Learned
1. **Character Detection**: Need context-aware NLP, not just keyword matching
2. **State Management**: Complex dialogue systems require formal state machines
3. **Error Handling**: Graceful degradation essential for AI-driven systems
4. **Performance**: Message processing needs rate limiting and deduplication
5. **Architecture**: Monolithic controllers become unmaintainable beyond 1000 lines