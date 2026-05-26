import { useState, useRef } from 'react';
import { streamPrompt } from '../utils/promptClient';
import { extractBlocksFromPDF } from '../utils/pdfExtractor';
import { processBlocks, splitTextFile } from '../utils/textProcessor';

const PRESETS = [
  {
    id: 'custom',
    label: 'Custom',
    prompt: '',
  },
  {
    id: 'translate',
    label: 'Translate → EN',
    prompt: 'Translate the following text to English. Return only the translation, with no commentary.',
  },
  {
    id: 'explain',
    label: 'Explain simply',
    prompt: 'Explain the following in simple, clear language that anyone can understand. Avoid jargon.',
  },
  {
    id: 'continue',
    label: 'Continue writing',
    prompt: 'Continue the following text in the same style, tone, and voice. Write naturally as a seamless continuation.',
  },
  {
    id: 'email',
    label: 'Write as email',
    prompt: 'Rewrite the following as a professional email. Include a subject line, greeting, body, and sign-off.',
  },
  {
    id: 'qa',
    label: 'Q&A assistant',
    prompt: 'Answer the following question or request helpfully, accurately, and concisely.',
  },
  {
    id: 'extract',
    label: 'Extract key info',
    prompt: 'Extract and list all key facts, names, dates, and figures from the following text. Use a structured format.',
  },
];


function sentsToText(sentences) {
  return sentences
    .filter((s) => s.type !== 'page-image')
    .map((s) => s.text)
    .join(' ');
}

export default function Prompt({ initialUserInput = '', apiKey, model, onSendToReader, onSendToSummarize, onSendToRefine, onNeedApiKey }) {
  const [systemPrompt, setSystemPrompt] = useState(
    () => localStorage.getItem('prompt_system') || ''
  );
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [userInput, setUserInput]   = useState(initialUserInput);
  const [output, setOutput]         = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError]           = useState('');
  const abortRef    = useRef(null);
  const fileInputRef = useRef(null);

  function pickPreset(preset) {
    setSelectedPreset(preset.id);
    setSystemPrompt(preset.prompt);
    localStorage.setItem('prompt_system', preset.prompt);
  }

  function handleSystemPromptChange(val) {
    setSystemPrompt(val);
    localStorage.setItem('prompt_system', val);
    // Deselect preset if user edits the prompt manually
    const match = PRESETS.find((p) => p.prompt === val);
    setSelectedPreset(match ? match.id : 'custom');
  }

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
      setUserInput(text);
      setOutput('');
    } catch (e) {
      setError(e.message);
    } finally {
      setFileLoading(false);
    }
  }

  async function handleRun() {
    if (!userInput.trim()) return;
    if (!apiKey) { onNeedApiKey?.(); return; }

    setOutput('');
    setIsStreaming(true);
    setError('');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamPrompt({
        systemPrompt, userInput, model, apiKey,
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

  return (
    <div className="prompt-view">

      {/* ── System prompt ── */}
      <section className="sum-section">
        <div className="sum-label">SYSTEM PROMPT</div>
        <div className="prompt-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`stt-lang-btn ${selectedPreset === p.id ? 'active' : ''}`}
              onClick={() => pickPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          className="refine-textarea prompt-system-textarea"
          placeholder="Describe how the AI should behave, what role it plays, or what rules to follow…"
          value={systemPrompt}
          onChange={(e) => handleSystemPromptChange(e.target.value)}
          rows={4}
        />
      </section>

      {/* ── User input ── */}
      <section className="sum-section">
        <div className="refine-input-header">
          <div className="sum-label">YOUR INPUT</div>
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
          placeholder="Type your message, question, or paste the text you want to process…"
          value={userInput}
          onChange={(e) => { setUserInput(e.target.value); setOutput(''); }}
          rows={6}
        />
        {userInput.length > 0 && (
          <div className="refine-input-meta">{userInput.length.toLocaleString()} chars</div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; }}
        />
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
            onClick={handleRun}
            disabled={!userInput.trim()}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run
          </button>
        )}
      </div>

      {error && <div className="sum-error">{error}</div>}

      {/* ── Output ── */}
      {(output || isStreaming) && (
        <section className="sum-section">
          <div className="sum-label">
            OUTPUT
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
              <button className="sum-txt-btn" onClick={() => { setUserInput(output); setOutput(''); }}>
                Use as input
              </button>
              <button className="sum-txt-btn" onClick={() => onSendToReader?.(output)}>
                Read in TTS →
              </button>
              {onSendToSummarize && (
                <button className="sum-txt-btn" onClick={() => onSendToSummarize(output)}>
                  Summarize →
                </button>
              )}
              {onSendToRefine && (
                <button className="sum-txt-btn sum-txt-btn--accent" onClick={() => onSendToRefine(output)}>
                  Refine →
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
