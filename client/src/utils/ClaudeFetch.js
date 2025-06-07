export async function callClaude(dialogueHistory, userInput) {
  const messages = [
    ...dialogueHistory.map(line => ({
      role: line.startsWith("You:") ? "user" : "assistant",
      content: line.replace(/^You:\s*|^Navarro:\s*/i, ""),
    })),
    { role: "user", content: userInput },
  ];

  const response = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-sonnet",
      messages,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[Empty response]";
}
