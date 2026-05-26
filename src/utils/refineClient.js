const STYLE_PROMPTS = {
  grammar:
    'Correct all grammar, spelling, and punctuation errors in the following text. Preserve the original wording and style — only fix mistakes. Return only the corrected text with no commentary.',
  polish:
    'Improve the following text for clarity, readability, and flow. Fix grammar, vary sentence structure, and smooth transitions while preserving the original meaning. Return only the improved text.',
  formal:
    'Rewrite the following text in a formal, professional tone. Use precise language, fix grammar, and maintain a neutral, authoritative voice. Return only the rewritten text.',
  casual:
    'Rewrite the following text in a friendly, casual, conversational tone. Make it feel natural and approachable. Return only the rewritten text.',
  concise:
    'Rewrite the following text to be significantly more concise. Cut redundancy, filler, and unnecessary detail while keeping all key information. Return only the condensed text.',
  expand:
    'Expand the following text with more context, detail, and explanation. Elaborate on key points to make it more comprehensive and informative. Return only the expanded text.',
};

export async function streamRefined({ text, style, model, apiKey, onChunk, signal }) {
  const systemPrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.grammar;

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
      max_tokens: 4096,
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
