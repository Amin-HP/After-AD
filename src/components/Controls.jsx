function formatCost(cost) {
  if (cost < 0.001) return '< $0.001';
  if (cost < 0.01) return `$${cost.toFixed(3)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(1)}`;
}

function formatChars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function Controls({
  isPlaying,
  hasSentences,
  onPlay,
  onStop,
  onPrev,
  onNext,
  onNewFile,
  onSummarize,
  onRefine,
  currentIdx,
  total,
  totalChars,
  estimatedCost,
  model,
}) {
  const progress = total > 0 && currentIdx >= 0 ? ((currentIdx + 1) / total) * 100 : 0;

  return (
    <div className="controls-bar">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="controls-inner">
        <button className="ctrl-btn ctrl-btn--ghost" onClick={onNewFile} title="Open new file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </button>

        <div className="playback-btns">
          <button className="ctrl-btn" onClick={onPrev} disabled={!hasSentences} title="Previous sentence">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>

          <button
            className="ctrl-btn ctrl-btn--primary"
            onClick={onPlay}
            disabled={!hasSentences}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button className="ctrl-btn" onClick={onNext} disabled={!hasSentences} title="Next sentence">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <button
          className="ctrl-btn ctrl-btn--ghost"
          onClick={onStop}
          disabled={!isPlaying && currentIdx < 0}
          title="Stop"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>

        {onSummarize && (
          <button
            className="ctrl-btn ctrl-btn--summarize"
            onClick={onSummarize}
            disabled={!hasSentences}
            title="Summarize this text"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span>Summarize</span>
          </button>
        )}
        {onRefine && (
          <button
            className="ctrl-btn ctrl-btn--refine"
            onClick={onRefine}
            disabled={!hasSentences}
            title="Refine this text"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Refine</span>
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="controls-meta">
          {currentIdx >= 0 ? (
            <span>{currentIdx + 1} / {total}</span>
          ) : (
            <span>{total} sentences</span>
          )}
          {totalChars > 0 && (
            <span className="cost-estimate" title={`${totalChars.toLocaleString()} characters · ${model}`}>
              {formatChars(totalChars)} chars · {formatCost(estimatedCost)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
