export async function streamPrompt({ systemPrompt, userInput, model, apiKey, onChunk, signal }) {
  const messages = [];
  if (systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userInput });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, stream: true, messages, max_tokens: 4096 }),
    signal,
  });

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const data = await response.json();
      message = data.error?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      } catch (_) {}
    }
  }
}
