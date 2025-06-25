import { useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Welcome, detective. How can I help?' }
  ]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // add user message
    setMessages((m) => [...m, { from: 'user', text: input }]);
    setLoading(true);

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input })
      });
      const { text } = await res.json();
      setMessages((m) => [...m, { from: 'bot', text }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { from: 'bot', text: '❌ Error: could not reach server.' }
      ]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !loading) sendMessage();
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="border rounded-lg p-2 h-64 overflow-y-auto mb-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`mb-1 ${
              m.from === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <span
              className={`inline-block px-3 py-1 rounded ${
                m.from === 'user'
                  ? 'bg-blue-200'
                  : 'bg-gray-200'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {loading && <div className="italic">…thinking…</div>}
      </div>

      <div className="flex">
        <input
          className="flex-1 border rounded-l px-2 py-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type your question…"
          disabled={loading}
        />
        <button
          className="bg-blue-500 text-white px-4 rounded-r"
          onClick={sendMessage}
          disabled={loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
