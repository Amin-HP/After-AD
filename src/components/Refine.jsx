import { useState, useRef } from 'react';
import { streamRefined } from '../utils/refineClient';
import { extractBlocksFromPDF } from '../utils/pdfExtractor';
import { processBlocks, splitTextFile } from '../utils/textProcessor';

const STYLES = [
  { id: 'grammar',  label: 'Fix Grammar', hint: 'Errors only'    },
  { id: 'polish',   label: 'Polish',       hint: 'Clarity & flow' },
  { id: 'formal',   label: 'Formal',       hint: 'Professional'   },
  { id: 'casual',   label: 'Casual',       hint: 'Conversational' },
  { id: 'concise',  label: 'Concise',      hint: 'Cut fluff'      },
  { id: 'expand',   label: 'Expand',       hint: 'Add detail'     },
];


function sentsToText(sentences) {
  return sentences
    .filter((s) => s.type !== 'page-image')
    .map((s) => s.text)
    .join(' ');
}

export default function Refine({ initialText = '', initialName = '', apiKey, model, onSendToReader, onSendToSummarize, onSendToPrompt, onNeedApiKey }) {
  const [inputText, setInputText]     = useState(initialText);
  const [style, setStyle]             = useState('grammar');
  const [output, setOutput]           = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError]             = useState('');
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
      setInputText(text);
      setOutput('');
    } catch (e) {
      setError(e.message);
    } finally {
      setFileLoading(false);
    }
  }

  async function handleRefine() {
    const text = inputText.trim();
    if (!text) return;
    if (!apiKey) { onNeedApiKey?.(); return; }

    setOutput('');
    setIsStreaming(true);
    setError('');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamRefined({
        text, style, model, apiKey,
        signal: ac.signal,
        onChunk: (chunk) => setOutput((s) => s + chunk),
      });
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  const charCount = inputText.length;

  return (
    <div className="refine-view">

      {/* ── Input text ── */}
      <section className="sum-section">
        <div className="refine-input-header">
          <div className="sum-label">TEXT TO REFINE</div>
          <div className="refine-input-actions">
            {fileLoading ? (
              <span className="refine-loading-hint">Loading…</span>
            ) : (
              <button className="sum-txt-btn" onClick={() => fileInputRef.current?.click()}>
                Load from file
              </button>
            )}
          </div>
        </div>
        <textarea
          className="refine-textarea"
          placeholder="Paste or type text here, or load a file…"
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setOutput(''); }}
          rows={8}
        />
        <div className="refine-input-meta">
          <span>{charCount > 0 ? `${charCount.toLocaleString()} chars` : ''}</span>
        </div>
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
        <div className="refine-style-grid">
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
            onClick={handleRefine}
            disabled={!inputText.trim()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Refine
          </button>
        )}
      </div>

      {error && <div className="sum-error">{error}</div>}

      {/* ── Output ── */}
      {(output || isStreaming) && (
        <section className="sum-section">
          <div className="sum-label">
            REFINED TEXT
            {isStreaming && <span className="sum-blink"> ●</span>}
          </div>
          <div className="sum-output">
            {output}
            {isStreaming && <span className="sum-cursor">▍</span>}
          </div>
          {!isStreaming && output && (
            <div className="sum-output-actions">
              <button className="sum-txt-btn" onClick={() => navigator.clipboard?.writeText(output)}>
                Copy
              </button>
              <button className="sum-txt-btn" onClick={() => setInputText(output)}>
                Use as input
              </button>
              <button className="sum-txt-btn" onClick={() => onSendToReader?.(output)}>
                Read in TTS →
              </button>
              {onSendToSummarize && (
                <button className="sum-txt-btn" onClick={() => onSendToSummarize?.(output)}>
                  Summarize →
                </button>
              )}
              {onSendToPrompt && (
                <button className="sum-txt-btn sum-txt-btn--accent" onClick={() => onSendToPrompt(output)}>
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
