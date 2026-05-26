import { useEffect, useRef } from 'react';

export default function TextDisplay({ sentences, currentIdx, onSentenceClick }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIdx]);

  const nodes = [];

  sentences.forEach((sentence, i) => {
    const isActive = i === currentIdx;
    const ref = isActive ? activeRef : null;

    if (sentence.type === 'page-image') {
      nodes.push(
        <div key={i} className="pdf-page-block">
          <span className="pdf-page-label">Page {sentence.pageNum}</span>
          <img
            src={sentence.url}
            alt={`Page ${sentence.pageNum}`}
            className="pdf-page-img"
            onClick={() => onSentenceClick(i)}
          />
        </div>
      );
      return;
    }

    const onClick = () => onSentenceClick(i);

    if (sentence.type === 'heading') {
      if (i > 0) nodes.push(<div key={`gap-${i}`} className="block-gap" />);
      nodes.push(
        <div
          key={i}
          ref={ref}
          className={`sentence sentence--heading ${isActive ? 'sentence--active' : ''}`}
          onClick={onClick}
          title="Click to read from here"
        >
          {sentence.text}
        </div>
      );
    } else {
      if (sentence.isBlockStart && i > 0 && sentences[i - 1]?.type !== 'heading') {
        nodes.push(<div key={`gap-${i}`} className="block-gap" />);
      }
      nodes.push(
        <span
          key={i}
          ref={ref}
          className={`sentence ${isActive ? 'sentence--active' : ''}`}
          onClick={onClick}
          title="Click to read from here"
        >
          {sentence.text}{' '}
        </span>
      );
    }
  });

  return (
    <div className="text-display">
      <div className="text-content">{nodes}</div>
    </div>
  );
}
