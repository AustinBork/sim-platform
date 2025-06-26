// proxy-server.cjs

const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const caseData = require('./server/caseData.json');

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
  let systemPrompt = `
You are Navarro, the detective's partner in a homicide investigation.
Case: ${caseData.title}
Scene: ${caseData.scene}
Remaining time: ${gameState.timeRemaining}
Evidence: ${gameState.evidence.join(', ') || 'None yet'}
Leads: ${gameState.leads.join(', ') || 'None yet'}

Guidelines:
- Only speak as Navarro. Never narrate Detective actions.
- Do NOT write any lines starting with "Detective ${gameState.detectiveName}:".
- Keep your responses in-character: concise, supportive, and occasionally witty.
`;

  // Merge into OpenAI format
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
