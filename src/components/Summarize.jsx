import { useState, useRef } from 'react';
import { streamSummary } from '../utils/summaryClient';
import { extractBlocksFromPDF } from '../utils/pdfExtractor';
import { processBlocks, splitTextFile } from '../utils/textProcessor';

const STYLES = [
  { id: 'concise',   label: 'Concise',       hint: '2–3 sentences' },
  { id: 'detailed',  label: 'Detailed',       hint: 'Full coverage'  },
  { id: 'bullets',   label: 'Bullet points',  hint: 'Key points'     },
  { id: 'takeaways', label: 'Takeaways',      hint: 'Top insights'   },
];


function sentsToText(sentences) {
  return sentences
    .filter((s) => s.type !== 'page-image')
    .map((s) => s.text)
    .join(' ');
}

export default function Summarize({ initialText, initialName, apiKey, model, onSendToReader, onSendToRefine, onSendToPrompt, onNeedApiKey }) {
  const [source, setSource] = useState(
    initialText ? { text: initialText, name: initialName } : null
  );
  const [style, setStyle]           = useState('concise');
  const [summary, setSummary]       = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError]           = useState('');
  const abortRef    = useRef(null);
  const fileInputRef = useRef(null);

  async function loadFile(file) {
    setFileLoading(true);
    setError('');
    try {
      let sents;
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const blocks = await extractBlocksFromPDF(file);
        sents = processBlocks(blocks);
      } else {
        sents = splitTextFile(await file.text());
      }
      const text = sentsToText(sents);
      if (!text.trim()) throw new Error('No readable text found.');
      setSource({ text, name: file.name });
      setSummary('');
    } catch (e) {
      setError(e.message);
    } finally {
      setFileLoading(false);
    }
  }

  async function handleSummarize() {
    if (!source?.text) return;
    if (!apiKey) { onNeedApiKey?.(); return; }

    setSummary('');
    setIsStreaming(true);
    setError('');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamSummary({
        text: source.text, style, model, apiKey,
        signal: ac.signal,
        onChunk: (chunk) => setSummary((s) => s + chunk),
      });
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  const charCount = source?.text?.length ?? 0;

  return (
    <div className="summarize-view">

      {/* ── Source ── */}
      <section className="sum-section">
        <div className="sum-label">SOURCE</div>

        {source ? (
          <div className="sum-source-card">
            <div className="sum-source-name">{source.name}</div>
            <div className="sum-source-meta">
              {charCount.toLocaleString()} chars
              {charCount > 120_000 && (
                <span className="sum-warn"> · Very long — model may truncate</span>
              )}
            </div>
            <div className="sum-source-btns">
              <button className="sum-txt-btn" onClick={() => fileInputRef.current?.click()}>
                Change file
              </button>
              <button className="sum-txt-btn" onClick={() => { setSource(null); setSummary(''); }}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`sum-drop-zone ${fileLoading ? 'sum-drop-zone--loading' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
          >
            {fileLoading ? (
              <><div className="spinner" /><span>Extracting text…</span></>
            ) : (
              <>
                <span className="sum-drop-icon">📄</span>
                <span className="sum-drop-title">Drop a file or click to browse</span>
                <span className="sum-drop-hint">PDF · TXT · MD</span>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; }}
        />
      </section>

      {/* ── Style ── */}
      <section className="sum-section">
        <div className="sum-label">STYLE</div>
        <div className="sum-style-grid">
          {STYLES.map((s) => (
            <button
              key={s.id}
              className={`sum-style-btn ${style === s.id ? 'active' : ''}`}
              onClick={() => setStyle(s.id)}
            >
              <span className="sum-style-name">{s.label}</span>
              <span className="sum-style-hint">{s.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Action ── */}
      <div className="sum-action-row">
        {isStreaming ? (
          <button className="sum-btn sum-btn--stop" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : (
          <button
            className="sum-btn sum-btn--go"
            onClick={handleSummarize}
            disabled={!source?.text}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Summarize
          </button>
        )}
      </div>

      {error && <div className="sum-error">{error}</div>}

      {/* ── Output ── */}
      {(summary || isStreaming) && (
        <section className="sum-section">
          <div className="sum-label">
            SUMMARY
            {isStreaming && <span className="sum-blink"> ●</span>}
          </div>
          <div className="sum-output">
            {summary}
            {isStreaming && <span className="sum-cursor">▍</span>}
          </div>
          {!isStreaming && summary && (
            <div className="sum-output-actions">
              <button
                className="sum-txt-btn"
                onClick={() => navigator.clipboard?.writeText(summary)}
              >
                Copy
              </button>
              <button
                className="sum-txt-btn"
                onClick={() => onSendToReader?.(summary)}
              >
                Read in TTS →
              </button>
              {onSendToRefine && (
                <button className="sum-txt-btn" onClick={() => onSendToRefine(summary)}>
                  Refine →
                </button>
              )}
              {onSendToPrompt && (
                <button className="sum-txt-btn sum-txt-btn--accent" onClick={() => onSendToPrompt(summary)}>
                  Prompt →
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
