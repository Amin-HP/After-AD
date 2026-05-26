const STYLE_PROMPTS = {
  concise:
    'Summarize the following text in 2–3 sentences. Be direct and capture only the core message.',
  detailed:
    'Write a comprehensive summary of the following text, covering all major points, arguments, and conclusions.',
  bullets:
    'Summarize the following text as a concise bullet-point list. Each bullet should capture a distinct key idea. Use "•" as the bullet character.',
  takeaways:
    'Extract the most important insights from the following text and present them as a numbered list of key takeaways.',
};

export async function streamSummary({ text, style, model, apiKey, onChunk, signal }) {
  const systemPrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.concise;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 2048,
    }),
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
