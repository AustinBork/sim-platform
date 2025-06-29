// proxy-server.cjs

const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const caseData = require('./server/caseData.json');
// ensure we have an array of suspects
const suspectList = Array.isArray(caseData.suspects) ? caseData.suspects : [];

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/chat', async (req, res) => {
  const { messages, gameState } = req.body;

  // Build dynamic system prompt
  const systemPrompt = `
You are the scene director and dialogue engine for a homicide investigation simulation.
Case: ${caseData.title}
Scene: ${caseData.scene}
Remaining time: ${gameState.timeRemaining}
Evidence: ${gameState.evidence.join(', ') || 'None yet'}
Leads: ${gameState.leads.join(', ') || 'None yet'}

Guidelines:
- Always respond with ONLY valid JSON objects (no extra prose).

- If the user's message includes explicit stage direction (enclosed in *...*), skip staging and emit:
    {"type":"dialogue","speaker":"<Character Name>","text":"<Their line>"}
  where <Character Name> is the NPC responding.

- Otherwise (user input is detective action or dialogue), do the following in order:
  1. Emit a stage object describing how Detective ${gameState.detectiveName} and Navarro proceed with the action.:
     {"type":"stage","description":"<Stage direction describing movement or action>"}
  2. Determine which NPC is being addressed (e.g., Marvin Lott for "neighbor") or who should speak next, and emit their dialogue:
     {"type":"dialogue","speaker":"<NPC Name>","text":"<Their line>"}

- For stage objects, use exactly: {"type":"stage","description":"<text>"}
- For dialogue objects, use exactly: {"type":"dialogue","speaker":"<Character Name>","text":"<text>"}

Characters you know:
- Navarro (the partner)
- Marvin Lott (neighbor)
- Mia Rodriguez (victim, only in backstory)
- [Other suspects from ${suspectList.join(', ')}]

+  Mapping hints:
+  - If the user says “neighbor”, “heard something”, or mentions “Marvin”, speak as **Marvin Lott**.
+  - If they refer to “victim”, “Mia”, or any stab-related detail, emit **only** a stage direction.
+  - If they name any suspect from [${suspectList.join(', ')}], speak as that suspect.
+

Ensure you pick the correct speaker and keep JSON strictly valid. No additional output.
`;

  // Build messages for OpenAI
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages
    });
    const text = response.choices[0].message.content;
    console.log('🔴 RAW MODEL OUTPUT:', text);
    res.json({ text });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ text: `❌ ${err.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
