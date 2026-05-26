// Chat completion models — used in Summarize, Refine, Prompt tabs
export const CHAT_MODELS = [
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', hint: 'Fastest · cheapest' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', hint: 'Fast · cheap'        },
  { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  hint: 'Fast · familiar'     },
  { id: 'gpt-4.1',      label: 'GPT-4.1',      hint: 'Capable'             },
  { id: 'gpt-4o',       label: 'GPT-4o',       hint: 'Capable · familiar'  },
  { id: 'o4-mini',      label: 'o4-mini',       hint: 'Reasoning'           },
];

// STT (transcription) models — used in Transcribe tab
export const STT_MODELS = [
  { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe', hint: 'Fast · $0.003/min'  },
  { id: 'gpt-4o-transcribe',      label: 'GPT-4o Transcribe',      hint: 'Best · $0.006/min'  },
  { id: 'whisper-1',              label: 'Whisper-1',              hint: 'Legacy · $0.006/min' },
];
