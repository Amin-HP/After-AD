import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

async function renderPageImage(page) {
  const viewport = page.getViewport({ scale: 1.4 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.88);
  });
}

async function extractPageBlocks(page) {
  const content = await page.getTextContent({ normalizeWhitespace: false });

  const items = content.items
    .filter((item) => 'str' in item && item.str.trim().length > 0)
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      fontSize: item.height > 0 ? item.height : Math.abs(item.transform[3]),
    }));

  if (items.length === 0) return [];

  const sizes = items.map((i) => i.fontSize).sort((a, b) => a - b);
  const medianSize = sizes[Math.floor(sizes.length / 2)];

  // Cluster into lines by Y
  const lineMap = new Map();
  for (const item of items) {
    const key = String(Math.round(item.y));
    if (!lineMap.has(key)) lineMap.set(key, { y: item.y, items: [], maxFontSize: 0 });
    const line = lineMap.get(key);
    line.items.push(item);
    line.maxFontSize = Math.max(line.maxFontSize, item.fontSize);
  }

  const lines = [...lineMap.values()].sort((a, b) => b.y - a.y);

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((i) => i.str).join('').replace(/\s+/g, ' ').trim();
    line.isHeading =
      line.maxFontSize > medianSize * 1.3 &&
      line.text.length < 180 &&
      !line.text.endsWith(',');
  }

  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0 && g < 60) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] || 14;

  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text) continue;

    const gap = i > 0 ? lines[i - 1].y - lines[i].y : 0;
    const isParaBreak = gap > medianGap * 1.6;

    if (line.isHeading) {
      if (current) blocks.push(current);
      blocks.push({ type: 'heading', text: line.text });
      current = null;
    } else if (!current || isParaBreak) {
      if (current) blocks.push(current);
      current = { type: 'paragraph', text: line.text };
    } else {
      if (current.text.endsWith('-')) {
        current.text = current.text.slice(0, -1) + line.text;
      } else {
        current.text += ' ' + line.text;
      }
    }
  }
  if (current) blocks.push(current);

  return blocks;
}

export async function extractBlocksFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allBlocks = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // Render full page as image (captures everything including images/charts)
    const imageUrl = await renderPageImage(page);
    allBlocks.push({ type: 'page-image', url: imageUrl, pageNum: i });

    // Extract text for TTS + highlighting
    const textBlocks = await extractPageBlocks(page);
    for (const block of textBlocks) {
      allBlocks.push({ ...block, pageNum: i });
    }
  }

  return allBlocks;
}
