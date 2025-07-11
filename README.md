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

case data tree. should be everything inside the the file all ties and connected to show build structure and intended designs and flow.

                                   [START: 07:50 AM – Arrival]
                                             |
                                     [Crime Scene – Apartment]
                                             |
   ---------------------------------------------------------------------------------------
   |                          |                           |                            |
[Bloodstain]         [Apartment Search]          [Photograph Room]        [Window Inspection]
   |                        |                           |                            |
[Send to DNA lab]     [Bracelet under couch]       [scene-photos Lead]         [Window ajar (exit)]
   |                        |                           |                            |
[Lead: blood-analysis]  [Partial print on knife]                                   
                                                     |
                                          [Forensics results in 6 hrs]

                                   (Meanwhile... Interview Phase)
                                             |
   ----------------------------------------------------------------------------------------
   |                              |                              |                       |
[Marvin Lott]           [Rachel Kim]               [Jordan Valez]       [Neighbor @ 3:30 AM]
   |                          |                             |                      |
Heard scream       Claims found body at 8 AM     Uber receipt clears him   Red Herring
   |                          |                             |                      
[Pull phone records]     Called Mia at 7:25 AM     Red Herring Suspect      
                              |
                     [Check doorbell footage]
                              |
                  Rachel caught leaving at 3:48 AM

                ----------------- EVIDENCE NETWORK -------------------
               |             |             |              |
     [Bracelet Charm] [Partial Print] [Phone Metadata] [Doorbell Footage]
               \__________   |   _________/      |
                            \ | /                 |
                            [Contradicts Rachel's Timeline]
                                      |
                            [Rachel becomes Primary Suspect]
                                      |
                             -----------------------------
                            |                             |
                      [Rachel’s Motive]           [Time of Attack: 2:45 AM]
             Obsession w/ Mia reconnecting      Used kitchen knife, wore gloves
               with Jordan (past jealousy)          Forgot to relock window
                                      |
                            [Final Arrest – Rachel Kim]
                          Second-degree murder, timeline proven
