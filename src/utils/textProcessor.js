const ABBREVS = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp|Co|approx|est|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./g;
const PLACEHOLDER = '\x00ABBREV\x00';

const PRICE_PER_CHAR = {
  'tts-1': 15 / 1_000_000,
  'tts-1-hd': 30 / 1_000_000,
  'gpt-4o-mini-tts': 0.6 / 1_000_000,
};

function splitRawText(text) {
  const safe = text.replace(ABBREVS, (m) => m.replace('.', PLACEHOLDER));
  const raw = safe.split(/(?<=[.!?])\s+(?=[A-Z"'"(])|(?<=[.!?])\s*\n+\s*/);
  return raw
    .map((s) => s.replace(new RegExp(PLACEHOLDER, 'g'), '.').trim())
    .filter((s) => s.length >= 15);
}

export function processBlocks(blocks) {
  const sentences = [];
  for (const block of blocks) {
    if (block.type === 'page-image') {
      sentences.push({ type: 'page-image', url: block.url, pageNum: block.pageNum, text: '', isBlockStart: false });
      continue;
    }
    const t = block.text.trim();
    if (!t) continue;
    if (block.type === 'heading') {
      sentences.push({ text: t, type: 'heading', isBlockStart: true });
    } else {
      const sents = splitRawText(t);
      const list = sents.length > 0 ? sents : [t];
      list.forEach((s, i) =>
        sentences.push({ text: s, type: 'paragraph', isBlockStart: i === 0 })
      );
    }
  }
  return sentences;
}

export function splitTextFile(text) {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .split(/\n{2,}/);

  const sentences = [];
  for (const para of paragraphs) {
    const t = para.trim();
    if (!t) continue;
    const sents = splitRawText(t);
    const list = sents.length > 0 ? sents : [t];
    list.forEach((s, i) =>
      sentences.push({ text: s, type: 'paragraph', isBlockStart: i === 0 })
    );
  }
  return sentences;
}

export function estimateCost(sentences, model) {
  const chars = sentences
    .filter((s) => s.type !== 'page-image')
    .reduce((sum, s) => sum + s.text.length, 0);
  const rate = PRICE_PER_CHAR[model] ?? PRICE_PER_CHAR['tts-1'];
  return { chars, cost: chars * rate };
}

export function chunkForTTS(text, maxChars = 4000) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const cut = remaining.lastIndexOf(' ', maxChars);
    chunks.push(remaining.slice(0, cut > 0 ? cut : maxChars));
    remaining = remaining.slice(cut > 0 ? cut + 1 : maxChars);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
