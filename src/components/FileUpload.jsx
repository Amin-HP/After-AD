import { useRef, useState } from 'react';
import { extractBlocksFromPDF } from '../utils/pdfExtractor';
import { processBlocks, splitTextFile } from '../utils/textProcessor';

export default function FileUpload({ onTextLoaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function processFile(file) {
    setError('');
    setLoading(true);
    try {
      let sentences;
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const blocks = await extractBlocksFromPDF(file);
        sentences = processBlocks(blocks);
      } else {
        const text = await file.text();
        sentences = splitTextFile(text);
      }
      if (sentences.length === 0) throw new Error('No readable text found in file.');
      onTextLoaded(sentences, file.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onInput(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md"
        onChange={onInput}
        style={{ display: 'none' }}
      />
      {loading ? (
        <div className="upload-loading">
          <div className="spinner" />
          <p>Extracting text…</p>
        </div>
      ) : (
        <div className="upload-content">
          <div className="upload-icon">📄</div>
          <p className="upload-title">Drop a file here, or click to browse</p>
          <p className="upload-hint">Supports PDF and plain text (.txt, .md)</p>
          {error && <p className="upload-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
