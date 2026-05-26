export async function transcribeAudio(audioBlob, { apiKey, language = '', model = 'gpt-4o-mini-transcribe' }, signal) {
  const formData = new FormData();
  const ext = audioBlob.type.includes('ogg') ? 'ogg'
    : audioBlob.type.includes('mp4') ? 'mp4'
    : audioBlob.type.includes('mpeg') ? 'mp3'
    : audioBlob.type.includes('wav') ? 'wav'
    : 'webm';
  formData.append('file', audioBlob, `audio.${ext}`);
  formData.append('model', model);
  if (language) formData.append('language', language);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
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

  const data = await response.json();
  return data.text ?? '';
}
