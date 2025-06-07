import { createContext, useContext, useState } from 'react';

const initialState = {
  timeRemaining: 48 * 60, // minutes
  currentTime: new Date('2025-01-01T07:50:00'),
  currentLocation: 'crimeScene',
  evidenceCollected: [],
  flags: {},
  dialogueHistory: [],
  difficulty: 'casual',
  availableActions: [],
  memoryLog: [], // for future extensibility
  log: [] // unified text feed for simulation
};

const GameStateContext = createContext();

export function GameStateProvider({ children }) {
  const [state, setState] = useState(() => {
    const tipLines = {
      easy: [
        "Type 'fixit' to rewind time if you mess up.",
        "Type 'notepad' to view case history, evidence, and tools.",
        "Ask for help anytime — Navarro has your back."
      ],
      casual: [
        "Use 'notepad' to review what you've done so far.",
        "You decide what to do — Navarro only helps in hard spots."
      ],
      hard: [
        "You're on your own. The clock is ticking.",
        "No tips. No help. Just instincts and facts."
      ]
    };

    const intro = [
      "[SYSTEM] Welcome, detective. You've got 48 hours to solve this.",
      "[SYSTEM] Say what you want. Do what you want. Good cop? Bad cop? This is your world. This is your cold case.",
      ...tipLines[initialState.difficulty].map(tip => `[TIP] ${tip}`)
    ];

    return {
      ...initialState,
      log: [...intro, ...initialState.log]
    };
  });

  const updateTime = (minutes) => {
    const newTime = new Date(state.currentTime.getTime() + minutes * 60000);
    const timestamp = newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    addLog(`[${timestamp}] Time advanced by ${minutes} minutes.`);

    setState((prev) => ({
      ...prev,
      timeRemaining: Math.max(prev.timeRemaining - minutes, 0),
      currentTime: newTime,
    }));
  };

  const addEvidence = (item) => {
    addLog(`Evidence collected: ${item}`);
    setState((prev) => ({
      ...prev,
      evidenceCollected: [...prev.evidenceCollected, item],
    }));
  };

  const addFlag = (key, value = true) => {
    setState((prev) => ({
      ...prev,
      flags: { ...prev.flags, [key]: value },
    }));
  };

  const addDialogue = (entry) => {
    addLog(entry);
    setState((prev) => ({
      ...prev,
      dialogueHistory: [...prev.dialogueHistory, entry],
    }));
  };

  const setDifficulty = (mode) => {
    setState((prev) => ({
      ...prev,
      difficulty: mode,
    }));
  };

  const setLocation = (location) => {
    addLog(`You moved to ${location}.`);
    setState((prev) => ({
      ...prev,
      currentLocation: location,
    }));
  };

  const setAvailableActions = (actions) => {
    setState((prev) => ({
      ...prev,
      availableActions: actions,
    }));
  };

  const addLog = (entry) => {
    const timestamp = state.currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setState((prev) => ({
      ...prev,
      log: [...prev.log, `[${timestamp}] ${entry}`]
    }));
  };

  // 🔧 TEST COMMAND 1: Simulate searching a location (for testing only)
  const searchLocation = (place) => {
    const found = place.toLowerCase() === 'kitchen';
    const result = found ?
      "You search the kitchen and find a blood-stained knife in the sink." :
      `You search the ${place}, but don't find anything useful.`;
    addDialogue(result);
  };

  // 🔧 TEST COMMAND 2: Simulate talking to Navarro (for testing only)
  const talkToNavarro = () => {
    const dialogue =
      "Navarro: \"Maybe we should follow up on the neighbor’s statement about the van.\"";
    addDialogue(dialogue);
  };

  return (
    <GameStateContext.Provider
      value={{
        state,
        updateTime,
        addEvidence,
        addFlag,
        addDialogue,
        setDifficulty,
        setLocation,
        setAvailableActions,
        addLog,
        searchLocation, // ⚠️ TEMP ONLY
        talkToNavarro // ⚠️ TEMP ONLY
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  return useContext(GameStateContext);
}
