import { useState } from 'react';
import { CHAT_MODELS, STT_MODELS } from '../utils/models';

const VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

const TTS_MODELS = [
  {
    id: 'tts-1',
    name: 'tts-1',
    quality: 'Standard',
    note: 'Faster response',
    price: '$15 / 1M chars',
  },
  {
    id: 'tts-1-hd',
    name: 'tts-1-hd',
    quality: 'High Definition',
    note: 'Better audio quality',
    price: '$30 / 1M chars',
  },
  {
    id: 'gpt-4o-mini-tts',
    name: 'gpt-4o-mini-tts',
    quality: 'GPT-4o Mini',
    note: 'Most natural voice',
    price: '$0.60 / 1M chars',
  },
];

function SectionTitle({ children }) {
  return <div className="settings-section-title">{children}</div>;
}

function ModelGrid({ models, value, onChange }) {
  return (
    <div className="settings-model-grid">
      {models.map((m) => (
        <button
          key={m.id}
          className={`settings-model-btn ${value === m.id ? 'active' : ''}`}
          onClick={() => onChange(m.id)}
          type="button"
        >
          <span className="settings-model-name">{m.label}</span>
          <span className="settings-model-hint">{m.hint}</span>
        </button>
      ))}
    </div>
  );
}

export default function Settings({ settings, onChange, onClose }) {
  const [local, setLocal] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  function update(field, value) {
    const next = { ...local, [field]: value };
    setLocal(next);
    onChange(next);
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">

          {/* ── API Key ── */}
          <div className="field">
            <span className="field-label">OpenAI API Key</span>
            <div className="key-input-wrap">
              <input
                type={showKey ? 'text' : 'password'}
                value={local.apiKey}
                onChange={(e) => update('apiKey', e.target.value)}
                placeholder="sk-..."
                className="text-input"
                autoComplete="off"
              />
              <button
                className="toggle-key-btn"
                onClick={() => setShowKey((v) => !v)}
                type="button"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field-hint">Saved in your browser only — never sent anywhere except OpenAI</span>
          </div>

          <SectionTitle>Reader (TTS)</SectionTitle>

          {/* ── TTS Model ── */}
          <div className="field">
            <span className="field-label">Model</span>
            <div className="model-list">
              {TTS_MODELS.map((m) => (
                <button
                  key={m.id}
                  className={`model-card ${local.ttsModel === m.id ? 'active' : ''}`}
                  onClick={() => update('ttsModel', m.id)}
                  type="button"
                >
                  <div className="model-card-top">
                    <span className="model-card-name">{m.name}</span>
                    <span className="model-card-price">{m.price}</span>
                  </div>
                  <div className="model-card-sub">
                    <span className="model-card-quality">{m.quality}</span>
                    <span className="model-card-note">{m.note}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Voice ── */}
          <div className="field">
            <span className="field-label">Voice</span>
            <div className="voice-grid">
              {VOICES.map((v) => (
                <button
                  key={v}
                  className={`voice-btn ${local.voice === v ? 'active' : ''}`}
                  onClick={() => update('voice', v)}
                  type="button"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* ── Speed ── */}
          <div className="field">
            <span className="field-label">
              Speed&ensp;<strong>{local.speed.toFixed(1)}×</strong>
            </span>
            <input
              type="range"
              min="0.25"
              max="4.0"
              step="0.25"
              value={local.speed}
              onChange={(e) => update('speed', parseFloat(e.target.value))}
              className="speed-slider"
            />
            <div className="speed-labels">
              <span>0.25×</span>
              <span>4×</span>
            </div>
          </div>

          <SectionTitle>Summarize</SectionTitle>

          <div className="field">
            <span className="field-label">Model</span>
            <ModelGrid models={CHAT_MODELS} value={local.sumModel} onChange={(v) => update('sumModel', v)} />
          </div>

          <SectionTitle>Refine</SectionTitle>

          <div className="field">
            <span className="field-label">Model</span>
            <ModelGrid models={CHAT_MODELS} value={local.refineModel} onChange={(v) => update('refineModel', v)} />
          </div>

          <SectionTitle>Prompt</SectionTitle>

          <div className="field">
            <span className="field-label">Model</span>
            <ModelGrid models={CHAT_MODELS} value={local.promptModel} onChange={(v) => update('promptModel', v)} />
          </div>

          <SectionTitle>Transcribe</SectionTitle>

          <div className="field">
            <span className="field-label">Model</span>
            <ModelGrid models={STT_MODELS} value={local.sttModel} onChange={(v) => update('sttModel', v)} />
          </div>

        </div>
      </div>
    </div>
  );
}
