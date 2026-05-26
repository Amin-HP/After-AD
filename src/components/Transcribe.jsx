import { useState, useRef, useEffect } from 'react';
import { transcribeAudio } from '../utils/sttClient';

const LANGUAGES = [
  { code: '', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'fa', label: 'Persian' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ar', label: 'Arabic' },
];

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Transcribe({ apiKey, sttModel, onSendToReader, onSendToSummarize, onSendToRefine, onSendToPrompt, onNeedApiKey }) {
  const [audioSource, setAudioSource] = useState(null); // { blob, name, url }
  const [language, setLanguage]       = useState('');
  const [transcript, setTranscript]   = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [recSeconds, setRecSeconds]         = useState(0);
  const [error, setError]                   = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const abortRef         = useRef(null);
  const fileInputRef     = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    abortRef.current?.abort();
    if (audioSource?.url) URL.revokeObjectURL(audioSource.url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      // Pick a format the browser and Whisper both like
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (audioSource?.url) URL.revokeObjectURL(audioSource.url);
        const url = URL.createObjectURL(blob);
        setAudioSource({ blob, name: 'Recording', url });
        setTranscript('');
      };

      mr.start(250); // collect every 250ms
      setIsRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError(`Microphone error: ${e.message}`);
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function loadFile(file) {
    setError('');
    if (audioSource?.url) URL.revokeObjectURL(audioSource.url);
    const url = URL.createObjectURL(file);
    setAudioSource({ blob: file, name: file.name, url });
    setTranscript('');
  }

  async function handleTranscribe() {
    if (!audioSource?.blob) return;
    if (!apiKey) { onNeedApiKey?.(); return; }

    setTranscript('');
    setIsTranscribing(true);
    setError('');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const text = await transcribeAudio(audioSource.blob, { apiKey, language, model: sttModel }, ac.signal);
      setTranscript(text);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setIsTranscribing(false);
      abortRef.current = null;
    }
  }

  function clearSource() {
    if (audioSource?.url) URL.revokeObjectURL(audioSource.url);
    setAudioSource(null);
    setTranscript('');
    setError('');
  }

  return (
    <div className="transcribe-view">

      {/* ── Record / Upload ── */}
      <section className="sum-section">
        <div className="sum-label">AUDIO SOURCE</div>

        {audioSource ? (
          <div className="sum-source-card">
            <div className="sum-source-name">{audioSource.name}</div>
            <audio className="stt-audio-preview" src={audioSource.url} controls />
            <div className="sum-source-btns">
              <button className="sum-txt-btn" onClick={() => fileInputRef.current?.click()}>
                Upload file
              </button>
              <button className="sum-txt-btn" onClick={startRecording} disabled={isRecording}>
                Record new
              </button>
              <button className="sum-txt-btn" onClick={clearSource}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="stt-source-row">
            {/* Record button */}
            {isRecording ? (
              <button className="stt-record-btn stt-record-btn--active" onClick={stopRecording}>
                <span className="stt-rec-dot" />
                <span>Stop · {formatTime(recSeconds)}</span>
              </button>
            ) : (
              <button className="stt-record-btn" onClick={startRecording}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span>Record audio</span>
              </button>
            )}

            {/* Divider */}
            <div className="stt-divider"><span>or</span></div>

            {/* Upload drop zone */}
            <div
              className="sum-drop-zone stt-upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
            >
              <span className="sum-drop-icon">🎵</span>
              <span className="sum-drop-title">Upload audio file</span>
              <span className="sum-drop-hint">MP3 · WAV · M4A · WebM · OGG</span>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; }}
        />
      </section>

      {/* ── Language ── */}
      <section className="sum-section">
        <div className="sum-label">LANGUAGE</div>
        <div className="stt-lang-row">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`stt-lang-btn ${language === l.code ? 'active' : ''}`}
              onClick={() => setLanguage(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Action ── */}
      <div className="sum-action-row">
        {isTranscribing ? (
          <button className="sum-btn sum-btn--stop" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : (
          <button
            className="sum-btn sum-btn--go"
            onClick={handleTranscribe}
            disabled={!audioSource?.blob}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Transcribe
            {isTranscribing && <span className="stt-spinner" />}
          </button>
        )}
      </div>

      {error && <div className="sum-error">{error}</div>}

      {/* ── Output ── */}
      {transcript && (
        <section className="sum-section">
          <div className="sum-label">TRANSCRIPT</div>
          <div className="sum-output">{transcript}</div>
          <div className="sum-output-actions">
            <button className="sum-txt-btn" onClick={() => navigator.clipboard?.writeText(transcript)}>
              Copy
            </button>
            <button className="sum-txt-btn" onClick={() => onSendToReader?.(transcript)}>
              Read in TTS →
            </button>
            <button className="sum-txt-btn" onClick={() => onSendToSummarize?.(transcript)}>
              Summarize →
            </button>
            {onSendToRefine && (
              <button className="sum-txt-btn" onClick={() => onSendToRefine(transcript)}>
                Refine →
              </button>
            )}
            {onSendToPrompt && (
              <button className="sum-txt-btn sum-txt-btn--accent" onClick={() => onSendToPrompt(transcript)}>
                Prompt →
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
