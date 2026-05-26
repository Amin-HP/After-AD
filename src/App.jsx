import { useState, useRef, useEffect } from 'react';
import Settings from './components/Settings';
import FileUpload from './components/FileUpload';
import TextDisplay from './components/TextDisplay';
import Controls from './components/Controls';
import Summarize from './components/Summarize';
import Transcribe from './components/Transcribe';
import Refine from './components/Refine';
import Prompt from './components/Prompt';
import { chunkForTTS, estimateCost, splitTextFile } from './utils/textProcessor';
import { synthesize } from './utils/ttsClient';
import './App.css';

function loadPersistedSettings() {
  return {
    apiKey:      localStorage.getItem('tts_api_key')    || '',
    voice:       localStorage.getItem('tts_voice')      || 'alloy',
    ttsModel:    localStorage.getItem('tts_model')      || 'tts-1',
    speed:       parseFloat(localStorage.getItem('tts_speed') || '1.0'),
    sumModel:    localStorage.getItem('sum_model')      || 'gpt-4.1-mini',
    refineModel: localStorage.getItem('refine_model')   || 'gpt-4.1-mini',
    promptModel: localStorage.getItem('prompt_model')   || 'gpt-4.1-mini',
    sttModel:    localStorage.getItem('stt_model')      || 'gpt-4o-mini-transcribe',
  };
}

function isText(sentence) {
  return sentence && sentence.type !== 'page-image';
}

// Find the next text-sentence index at or after `idx`
function nextTextIdx(sents, idx) {
  let i = idx;
  while (i < sents.length && !isText(sents[i])) i++;
  return i < sents.length ? i : -1;
}

// Count text-only sentences and map all-index → text-rank
function textStats(sentences, currentIdx) {
  let total = 0;
  let rank = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (isText(sentences[i])) {
      if (i <= currentIdx && currentIdx >= 0) rank = total;
      total++;
    }
  }
  return { total, rank };
}

export default function App() {
  const [settings, setSettings] = useState(loadPersistedSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('reader');
  const [summarizeInput, setSummarizeInput] = useState(null); // { text, name }
  const [transcribeKey, setTranscribeKey] = useState(0);
  const [refineInput, setRefineInput] = useState({ text: '', name: '' });
  const [promptUserInput, setPromptUserInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [sentences, setSentences] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');

  const playActiveRef = useRef(false);
  const currentIdxRef = useRef(-1);
  const audioRef = useRef(null);
  const stopResolveRef = useRef(null);
  const audioCacheRef = useRef({});
  const settingsRef = useRef(settings);
  const sentencesRef = useRef([]);
  const blobUrlsRef = useRef([]);
  // Incremented on every hardStop — each loop instance captures its own value
  // and exits as soon as it detects a mismatch.
  const loopGenRef = useRef(0);
  const fetchAbortRef = useRef(null);

  // Revoke blob URLs (PDF page images) when a new file is loaded
  function revokePdfImages() {
    for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
    blobUrlsRef.current = [];
  }

  useEffect(() => () => revokePdfImages(), []);

  function handleSettingsChange(next) {
    setSettings(next);
    settingsRef.current = next;
    localStorage.setItem('tts_api_key',   next.apiKey);
    localStorage.setItem('tts_voice',     next.voice);
    localStorage.setItem('tts_model',     next.ttsModel);
    localStorage.setItem('tts_speed',     String(next.speed));
    localStorage.setItem('sum_model',     next.sumModel);
    localStorage.setItem('refine_model',  next.refineModel);
    localStorage.setItem('prompt_model',  next.promptModel);
    localStorage.setItem('stt_model',     next.sttModel);
    audioCacheRef.current = {};
  }

  function handleTextLoaded(sents, name) {
    hardStop();
    revokePdfImages();
    // Track blob URLs for cleanup
    blobUrlsRef.current = sents
      .filter((s) => s.type === 'page-image')
      .map((s) => s.url);
    sentencesRef.current = sents;
    setSentences(sents);
    setFileName(name);
    setCurrentIdx(-1);
    currentIdxRef.current = -1;
    audioCacheRef.current = {};
    setError('');
  }

  function hardStop() {
    loopGenRef.current++;           // invalidate any running loop
    fetchAbortRef.current?.abort(); // cancel any in-flight API call immediately
    fetchAbortRef.current = null;
    playActiveRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopResolveRef.current?.(); // unblock any awaiting playUrls promise
    stopResolveRef.current = null;
  }

  // Fire-and-forget pre-fetch; discards result if generation has advanced.
  function prefetchAhead(fromIdx, count = 2) {
    const gen = loopGenRef.current;
    const sents = sentencesRef.current;
    let filled = 0;
    let i = fromIdx;
    while (filled < count && i < sents.length) {
      if (isText(sents[i]) && !audioCacheRef.current[i]) {
        (async (idx) => {
          try {
            const chunks = chunkForTTS(sents[idx].text);
            const urls = await Promise.all(
              chunks.map((c) => synthesize(c, settingsRef.current))
            );
            // Only cache if we're still in the same playback session
            if (loopGenRef.current === gen) audioCacheRef.current[idx] = urls;
          } catch (_) {}
        })(i);
        filled++;
      }
      i++;
    }
  }

  // Play a list of audio URLs sequentially.
  // Exits early if the loop generation has been superseded.
  async function playUrls(urls, gen) {
    for (const url of urls) {
      if (loopGenRef.current !== gen) return;
      await new Promise((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        stopResolveRef.current = resolve;
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
    }
  }

  async function startFrom(rawIdx) {
    if (!settingsRef.current.apiKey) {
      setError('Add your OpenAI API key in Settings first.');
      setShowSettings(true);
      return;
    }

    const sents = sentencesRef.current;
    const idx = nextTextIdx(sents, rawIdx);
    if (idx < 0) return;

    hardStop();
    // Capture the generation AFTER hardStop incremented it.
    const myGen = loopGenRef.current;
    playActiveRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    setError('');

    prefetchAhead(idx, 2);

    for (let i = idx; i < sents.length; i++) {
      if (loopGenRef.current !== myGen) break;
      if (!isText(sents[i])) continue;

      currentIdxRef.current = i;
      setCurrentIdx(i);
      prefetchAhead(i + 1, 2);

      try {
        if (!audioCacheRef.current[i]) {
          // Create a fresh abort controller so hardStop() can cancel this fetch.
          const ac = new AbortController();
          fetchAbortRef.current = ac;
          const chunks = chunkForTTS(sents[i].text);
          const urls = await Promise.all(
            chunks.map((c) => synthesize(c, settingsRef.current, ac.signal))
          );
          fetchAbortRef.current = null;
          if (loopGenRef.current !== myGen) break;
          audioCacheRef.current[i] = urls;
        }
        if (loopGenRef.current !== myGen) break;
        await playUrls(audioCacheRef.current[i], myGen);
      } catch (e) {
        if (e.name === 'AbortError') break; // paused/stopped mid-fetch — silent exit
        if (loopGenRef.current === myGen) setError(`Error: ${e.message}`);
        break;
      }
    }

    // Only clean up if we're still the active loop (not superseded by a new one).
    if (loopGenRef.current === myGen) {
      playActiveRef.current = false;
      setIsPlaying(false);
      setCurrentIdx(-1);
      currentIdxRef.current = -1;
    }
  }

  function handlePlay() {
    if (isPlaying) {
      // Pause: stop everything but keep currentIdx so resume knows where to restart.
      hardStop(); // sets isPlaying=false, isPaused=false
      setIsPaused(true); // override — React batches this with hardStop's setState calls
    } else if (isPaused) {
      setIsPaused(false);
      startFrom(currentIdxRef.current >= 0 ? currentIdxRef.current : 0);
    } else {
      startFrom(currentIdxRef.current >= 0 ? currentIdxRef.current : 0);
    }
  }

  function handleStop() {
    hardStop();
    setCurrentIdx(-1);
    currentIdxRef.current = -1;
  }

  function handlePrev() {
    const sents = sentencesRef.current;
    let from = Math.max(0, currentIdxRef.current - 1);
    while (from > 0 && !isText(sents[from])) from--;
    startFrom(from);
  }

  function handleNext() {
    const sents = sentencesRef.current;
    const from = nextTextIdx(sents, currentIdxRef.current + 1);
    if (from >= 0) startFrom(from);
  }

  function handleNewFile() {
    hardStop();
    revokePdfImages();
    sentencesRef.current = [];
    setSentences([]);
    setFileName('');
    setCurrentIdx(-1);
    currentIdxRef.current = -1;
    audioCacheRef.current = {};
    setError('');
  }

  // Send current reader text to the Summarize tab
  function handleSendToSummarize() {
    const text = sentences
      .filter((s) => s.type !== 'page-image')
      .map((s) => s.text)
      .join(' ');
    setSummarizeInput({ text, name: fileName });
    setActiveTab('summarize');
  }

  // Load the generated summary back into the Reader as new text
  function handleSummaryToReader(summaryText) {
    const sents = splitTextFile(summaryText);
    handleTextLoaded(sents, 'Summary');
    setActiveTab('reader');
  }

  // Send text to Prompt tab as user input
  function handleSendToPrompt(text) {
    setPromptUserInput(text);
    setActiveTab('prompt');
  }

  // Send text (from any tab) to Refine tab
  function handleSendToRefine(text, name = '') {
    setRefineInput({ text, name });
    setActiveTab('refine');
  }

  // Send transcript text to Summarize tab
  function handleTranscriptToSummarize(text) {
    setSummarizeInput({ text, name: 'Transcript' });
    setActiveTab('summarize');
  }

  // Load transcript text into the Reader
  function handleTranscriptToReader(text) {
    const sents = splitTextFile(text);
    handleTextLoaded(sents, 'Transcript');
    setActiveTab('reader');
  }

  const { chars, cost } = estimateCost(sentences, settings.ttsModel);
  const { total: textTotal, rank: textRank } = textStats(sentences, currentIdx);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">◉</span>
          <span className="app-name">After AD</span>
        </div>

        {/* Tab navigation */}
        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'reader' ? 'active' : ''}`}
            onClick={() => setActiveTab('reader')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            Reader
          </button>
          <button
            className={`tab-btn ${activeTab === 'summarize' ? 'active' : ''}`}
            onClick={() => setActiveTab('summarize')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Summarize
          </button>
          <button
            className={`tab-btn ${activeTab === 'transcribe' ? 'active' : ''}`}
            onClick={() => setActiveTab('transcribe')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Transcribe
          </button>
          <button
            className={`tab-btn ${activeTab === 'refine' ? 'active' : ''}`}
            onClick={() => setActiveTab('refine')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Refine
          </button>
          <button
            className={`tab-btn ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Prompt
          </button>
        </nav>

        {fileName && activeTab === 'reader' && (
          <span className="file-chip">{fileName}</span>
        )}

        <button className="settings-trigger" onClick={() => setShowSettings(true)} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* ── Reader tab ── */}
      {activeTab === 'reader' && (
        <>
          <main className="app-main">
            {sentences.length === 0 ? (
              <div className="upload-wrapper">
                <FileUpload onTextLoaded={handleTextLoaded} />
              </div>
            ) : (
              <TextDisplay
                sentences={sentences}
                currentIdx={currentIdx}
                onSentenceClick={startFrom}
              />
            )}
          </main>

          {sentences.length > 0 && (
            <Controls
              isPlaying={isPlaying}
              isPaused={isPaused}
              hasSentences={textTotal > 0}
              onPlay={handlePlay}
              onStop={handleStop}
              onPrev={handlePrev}
              onNext={handleNext}
              onNewFile={handleNewFile}
              onSummarize={handleSendToSummarize}
              onRefine={() => {
                const text = sentences.filter((s) => s.type !== 'page-image').map((s) => s.text).join(' ');
                handleSendToRefine(text, fileName);
              }}
              currentIdx={textRank}
              total={textTotal}
              totalChars={chars}
              estimatedCost={cost}
              model={settings.ttsModel}
            />
          )}
        </>
      )}

      {/* ── Summarize tab ── */}
      {activeTab === 'summarize' && (
        <main className="app-main">
          <Summarize
            key={summarizeInput?.name + summarizeInput?.text?.slice(0, 20)}
            initialText={summarizeInput?.text}
            initialName={summarizeInput?.name}
            apiKey={settings.apiKey}
            model={settings.sumModel}
            onSendToReader={handleSummaryToReader}
            onSendToRefine={(text) => handleSendToRefine(text, 'Summary')}
            onSendToPrompt={handleSendToPrompt}
            onNeedApiKey={() => setShowSettings(true)}
          />
        </main>
      )}

      {/* ── Refine tab ── */}
      {activeTab === 'refine' && (
        <main className="app-main">
          <Refine
            key={refineInput.name + refineInput.text.slice(0, 20)}
            initialText={refineInput.text}
            initialName={refineInput.name}
            apiKey={settings.apiKey}
            model={settings.refineModel}
            onSendToReader={(text) => { const sents = splitTextFile(text); handleTextLoaded(sents, 'Refined'); setActiveTab('reader'); }}
            onSendToSummarize={(text) => { setSummarizeInput({ text, name: 'Refined' }); setActiveTab('summarize'); }}
            onSendToPrompt={handleSendToPrompt}
            onNeedApiKey={() => setShowSettings(true)}
          />
        </main>
      )}

      {/* ── Prompt tab ── */}
      {activeTab === 'prompt' && (
        <main className="app-main">
          <Prompt
            key={promptUserInput.slice(0, 20)}
            initialUserInput={promptUserInput}
            apiKey={settings.apiKey}
            model={settings.promptModel}
            onSendToReader={(text) => { const sents = splitTextFile(text); handleTextLoaded(sents, 'Prompt output'); setActiveTab('reader'); }}
            onSendToSummarize={(text) => { setSummarizeInput({ text, name: 'Prompt output' }); setActiveTab('summarize'); }}
            onSendToRefine={(text) => handleSendToRefine(text, 'Prompt output')}
            onNeedApiKey={() => setShowSettings(true)}
          />
        </main>
      )}

      {/* ── Transcribe tab ── */}
      {activeTab === 'transcribe' && (
        <main className="app-main">
          <Transcribe
            key={transcribeKey}
            apiKey={settings.apiKey}
            sttModel={settings.sttModel}
            onSendToReader={handleTranscriptToReader}
            onSendToSummarize={handleTranscriptToSummarize}
            onSendToRefine={(text) => handleSendToRefine(text, 'Transcript')}
            onSendToPrompt={handleSendToPrompt}
            onNeedApiKey={() => setShowSettings(true)}
          />
        </main>
      )}

      {error && (
        <div className="error-toast" onClick={() => setError('')}>
          {error} <span className="error-dismiss">✕</span>
        </div>
      )}

      {showSettings && (
        <Settings
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
