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



Refactor for Robustness: The current tight coupling between components makes debugging difficult. Consider refactoring to use a more state-driven approach like Redux or Context API.
AI Response Improvements: The AI responses need more structure and consistency. Consider using a more structured approach with defined response templates.
Fallback Mechanisms: Add more robust fallback mechanisms when components fail to communicate properly.
Documentation: Add better documentation for the game mechanics and expected behavior to make future debugging easier.

This comprehensive fix should address all the major issues with the game and get it back to a fully functional state. The approach focuses on fixing the core mechanics first and then addressing UI and polish issues.
