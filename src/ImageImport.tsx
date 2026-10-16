import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Link2, LoaderCircle, Upload, X } from 'lucide-react';
import { prepareUpload, previewImageUrl, type CustomImage } from './image-input';

export default function ImageImport({ onChoose, active, onBack }: { onChoose: (image: CustomImage) => void; active: boolean; onBack: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);

  async function choose(prepare: () => Promise<CustomImage>) {
    const current = ++version.current;
    setBusy(true);
    setError('');
    try {
      const image = await prepare();
      if (current !== version.current) {
        URL.revokeObjectURL(image.image);
        return;
      }
      onChoose(image);
      setExpanded(false);
      setUrl('');
    } catch (failure) {
      if (current === version.current) setError(failure instanceof Error ? failure.message : 'This image could not be opened. Try a different image.');
    } finally {
      if (current === version.current) setBusy(false);
    }
  }

  function close() {
    version.current++;
    setBusy(false);
    setExpanded(false);
    setError('');
  }

  return <section className={`image-import ${expanded ? 'is-expanded' : ''}`} aria-label="Try your own image">
    <div className="import-toolbar">
      <div><ImagePlus size={17} strokeWidth={1.4} /><span>{active ? 'YOUR OWN LOOKING ROOM' : 'HAVE A PAINTING IN MIND?'}</span></div>
      <div className="import-toolbar-actions">{active && <button onClick={() => { close(); onBack(); }}><ArrowLeft size={13} /> Back to collection</button>}<button onClick={() => expanded ? close() : setExpanded(true)} aria-expanded={expanded}>{expanded ? <><X size={14} /> Close</> : <>{active ? 'Choose another' : 'Try your own painting'}<ArrowUpRightIcon /></>}</button></div>
    </div>
    {expanded && <div className="import-content">
      <div className="import-introduction"><h3>A different painting.<br /><em>The same curious eye.</em></h3><p>Bring an image from your device, or import one from a public image link. You’ll preview it here before running the model.</p></div>
      <div className="import-fields">
        <div className="import-tabs" role="tablist" aria-label="Image source"><button id="upload-tab" role="tab" aria-selected={tab === 'upload'} aria-controls="upload-panel" disabled={busy} onClick={() => { setTab('upload'); setError(''); }}><Upload size={13} /> Upload</button><button id="url-tab" role="tab" aria-selected={tab === 'url'} aria-controls="url-panel" disabled={busy} onClick={() => { setTab('url'); setError(''); }}><Link2 size={13} /> Image URL</button></div>
        {tab === 'upload' ? <div id="upload-panel" role="tabpanel" aria-labelledby="upload-tab"><label className={`upload-dropzone ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file && !busy) void choose(() => prepareUpload(file)); }}><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void choose(() => prepareUpload(file)); event.target.value = ''; }} />{busy ? <LoaderCircle className="spin" size={23} /> : <Upload size={23} strokeWidth={1.3} />}<strong>{busy ? 'Preparing your image…' : 'Choose an image or drop it here'}</strong><span>JPEG, PNG, or WebP · up to 8 MB</span></label><p className="import-hint">Uploads are oriented and resized in your browser, with embedded metadata removed.</p></div> : <form id="url-panel" role="tabpanel" aria-labelledby="url-tab" onSubmit={(event) => { event.preventDefault(); if (!busy) void choose(() => previewImageUrl(url)); }}><label className="url-label" htmlFor="image-url">Direct HTTPS image link</label><div className="url-input-row"><input id="image-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.org/painting.jpg" required maxLength={2048} disabled={busy} autoComplete="off" spellCheck={false} /><button type="submit" disabled={busy || !url.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={17} />}<span className="sr-only">Preview image</span></button></div><p className="import-hint">The image host must allow browser imports. If it blocks access or redirects, download the image and use Upload instead.</p>{busy && <p className="import-busy">Importing and preparing the image…</p>}</form>}
        {error && <p className="import-error" role="alert">{error}</p>}
      </div>
    </div>}
  </section>;
}

function ArrowUpRightIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" /></svg>;
}
