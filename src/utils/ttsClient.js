export async function synthesize(text, { apiKey, voice, ttsModel, speed }, signal) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: ttsModel, input: text, voice, speed }),
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

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
