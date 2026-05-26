# After AD

A macOS desktop app for reading, transcribing, summarizing, refining, and prompting text — powered by OpenAI APIs.

Built with React + Vite, packaged as a native Electron app.

---

## Features

| Tab | What it does |
|---|---|
| **Reader** | Load `.txt`, `.md`, or `.pdf` files and listen with text-to-speech. Sentence-by-sentence playback with click-to-jump. |
| **Summarize** | Paste or send text and get a streamed AI summary. |
| **Transcribe** | Record from microphone or upload an audio file. Transcribes using OpenAI Whisper. |
| **Refine** | Correct grammar, polish tone, formalize, make casual, shorten, or expand any text. |
| **Prompt** | Free-form prompt interface with a custom system prompt, preset templates, and streaming output. |

All tabs are connected — you can send text between any of them with one click.

---

## Requirements

- macOS (arm64 or x64)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- Node.js 18+ (for development only)

---

## Installation

### Build and install

```bash
# 1. Install dependencies
npm install

# 2. Build the app
npm run electron:build
```

After the build completes:

1. Drag `release/mac-arm64/After AD.app` to `/Applications`.
2. Open the app and go to **Settings** (gear icon, top-right).
3. Enter your OpenAI API key. It is stored locally in your browser's `localStorage` — never sent anywhere except OpenAI.

### Run at startup

System Settings → General → Login Items & Extensions → add `After AD.app`.

---

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (Vite dev server + Electron)
npm run electron:dev

# Or run just the web UI in a browser
npm run dev
```

The dev server runs at `http://localhost:5173`. Electron loads that URL when `NODE_ENV=development`.

---

## Build

```bash
# Build the Vite bundle + package as a macOS .app / .dmg
npm run electron:build
```

Output is in `release/`:
- `release/mac-arm64/After AD.app` — the native app bundle
- `release/After AD-1.0.0-arm64.dmg` — distributable disk image (if the build succeeds on your Python version)

> **Note:** DMG creation requires Python's `plistlib`. Python 3.14 has a known incompatibility with `dmgbuild`. If DMG creation fails, use the `.app` bundle directly.

---

## Settings

Open Settings (⚙ icon) to configure:

| Setting | Description |
|---|---|
| **API Key** | Your OpenAI secret key |
| **TTS Model** | `tts-1` (fast) or `tts-1-hd` (higher quality) |
| **Voice** | 9 voices: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer |
| **Speed** | 0.5× – 2.0× playback speed |
| **Summarize Model** | Chat model used in the Summarize tab |
| **Refine Model** | Chat model used in the Refine tab |
| **Prompt Model** | Chat model used in the Prompt tab |
| **Transcribe Model** | STT model used in the Transcribe tab |

All settings are persisted in `localStorage`.

### Available models

**Chat (Summarize / Refine / Prompt)**
- `gpt-4.1-nano` — Fastest, cheapest
- `gpt-4.1-mini` — Fast, cheap
- `gpt-4o-mini` — Fast, familiar
- `gpt-4.1` — Capable
- `gpt-4o` — Capable, familiar
- `o4-mini` — Reasoning

**Speech-to-Text (Transcribe)**
- `gpt-4o-mini-transcribe` — Fast · $0.003/min
- `gpt-4o-transcribe` — Best · $0.006/min
- `whisper-1` — Legacy · $0.006/min

---

## Project Structure

```
After AD/
├── electron/
│   └── main.cjs          # Electron main process (Node.js HTTP server + BrowserWindow)
├── src/
│   ├── App.jsx            # Root component, state, tab routing
│   ├── App.css            # All styles
│   ├── components/
│   │   ├── Controls.jsx   # Playback controls bar
│   │   ├── FileUpload.jsx # File drop zone
│   │   ├── Prompt.jsx     # Custom prompt tab
│   │   ├── Refine.jsx     # Text refine tab
│   │   ├── Settings.jsx   # Settings panel
│   │   ├── Summarize.jsx  # Summarize tab
│   │   ├── TextDisplay.jsx# Sentence-by-sentence reader view
│   │   └── Transcribe.jsx # Speech-to-text tab
│   └── utils/
│       ├── models.js       # Central model registry (CHAT_MODELS, STT_MODELS)
│       ├── pdfExtractor.js # PDF → sentences via pdf.js
│       ├── promptClient.js # OpenAI chat streaming for Prompt tab
│       ├── refineClient.js # OpenAI chat streaming for Refine tab
│       ├── sttClient.js    # OpenAI /v1/audio/transcriptions
│       ├── summaryClient.js# OpenAI chat streaming for Summarize tab
│       ├── textProcessor.js# Text → sentence chunks, cost estimation
│       └── ttsClient.js    # OpenAI /v1/audio/speech
├── public/
│   └── favicon.svg
├── index.html
├── package.json
└── vite.config.js
```

---

## How it works (Electron packaging)

The Electron main process starts a local HTTP server on port `45173` that serves the Vite-built `dist/` folder. This avoids `file://` protocol restrictions (needed for pdf.js workers) and lets the app work identically in dev and production.

`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers are set by the server to enable `SharedArrayBuffer` support required by pdf.js.

In the packaged app, `dist/` is placed in `Resources/dist/` via `electron-builder`'s `extraResources` config.
