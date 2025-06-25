// proxy-server.cjs
require('dotenv').config();
const path = require('path');
const caseData = require(path.join(__dirname, 'server', 'caseData.json'));
const cors = require('cors');
const express = require('express');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Log each request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/chat', async (req, res) => {
  const { messages, gameState } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Need a non-empty messages array' });
  }
  if (!gameState || typeof gameState.mode !== 'string') {
    return res.status(400).json({ error: 'Missing gameState.mode in body' });
  }

  // Personality & hint policy
  const navDesc = caseData.people.navarro.description;
  let hintPolicy = '';
  switch (gameState.mode) {
    case 'Easy':
      hintPolicy = 'Navarro will proactively hint and nudge you along.';
      break;
    case 'Classic':
      hintPolicy = 'Navarro only reminds or reframes what’s known when asked.';
      break;
    case 'Hard':
      hintPolicy = 'Navarro defers to you—minimal guidance unless explicitly requested.';
      break;
  }

  // Build system prompt
  const systemMsg = {
    role: 'system',
    content: `
🎲 First 48: ${caseData.case.title}
🔎 Scene: ${caseData.victim.scene.location}
⏰ Time: ${gameState.currentTime} (Remaining: ${gameState.timeRemaining})
📋 Evidence: ${gameState.evidence.join(', ') || 'None yet'}
🗂️ Leads: ${gameState.leads.join(', ') || 'None yet'}
🎯 Mode: ${gameState.mode} — ${hintPolicy}

Navarro: ${navDesc}

You are Navarro, the detective partner. Use real police logic, track time & availability, manage leads & evidence. Respond immersively.
    `.trim()
  };

  const promptHistory = [systemMsg, ...messages];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: promptHistory
    });
    res.json({ text: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
