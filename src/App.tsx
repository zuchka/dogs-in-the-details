import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight,
  Check, ChevronRight, Code2, Copy, Eye, EyeOff, Info, LoaderCircle,
  Scan, ScanLine, Share2, X,
} from 'lucide-react';
import type { Artwork, Detection, DetectionResult } from './types';

const DEFAULT_THRESHOLD = 0.35;

function displayDate(iso: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function recordLiveExport(artworkId: number) {
  try {
    const key = 'dogs-in-the-details-session';
    const sessionId = sessionStorage.getItem(key) ?? crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'live_inference_exported', sessionId, artworkId }),
      keepalive: true,
    }).catch(() => { /* Analytics must not interrupt the download. */ });
  } catch { /* Export remains available when session storage is restricted. */ }
}

function DogCrop({ artwork, detection }: { artwork: Artwork; detection: Detection }) {
  const pad = 0.18;
  const left = Math.max(0, detection.x - detection.width * pad);
  const top = Math.max(0, detection.y - detection.height * pad);
  const right = Math.min(1, detection.x + detection.width * (1 + pad));
  const bottom = Math.min(1, detection.y + detection.height * (1 + pad));
  return (
    <svg className="dog-crop" viewBox={`${left * artwork.width} ${top * artwork.height} ${(right - left) * artwork.width} ${(bottom - top) * artwork.height}`} role="img" aria-label={`Detail detected as a dog in ${artwork.title}`} preserveAspectRatio="xMidYMid slice">
      <image href={artwork.image} width={artwork.width} height={artwork.height} />
    </svg>
  );
}

function App() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manifestError, setManifestError] = useState('');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [showBoxes, setShowBoxes] = useState(true);
  const [activeDetection, setActiveDetection] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showHow, setShowHow] = useState(false);
  const [copied, setCopied] = useState<'share' | 'code' | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const requestVersion = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detectAbort = useRef<AbortController | null>(null);

  const artwork = artworks.find((item) => item.id === selectedId);
  const artworkIndex = artworks.findIndex((item) => item.id === selectedId);
  const dogs = result?.detections.filter((dog) => dog.confidence >= threshold) ?? [];

  useEffect(() => {
    const controller = new AbortController();
    fetch('/artworks.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The collection could not be loaded. Please refresh to try again.');
        return response.json() as Promise<Artwork[]>;
      })
      .then((items) => {
        if (!items.length) throw new Error('The collection is being prepared. Please check back shortly.');
        setArtworks(items);
        const requestedId = Number(new URLSearchParams(window.location.search).get('artwork'));
        setSelectedId(items.some((item) => item.id === requestedId) ? requestedId : items.find((item) => item.id === 27992)?.id ?? items[0].id);
      })
      .catch((failure: Error) => { if (failure.name !== 'AbortError') setManifestError(failure.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    detectAbort.current?.abort();
    setResult(null);
    setRunning(false);
    setError('');
    setActiveDetection(null);
    setImageLoaded(false);
    setImageError(false);
    const url = new URL(window.location.href);
    url.searchParams.set('artwork', String(selectedId));
    window.history.replaceState({}, '', url);
    fetch(`/results/${selectedId}.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
        return response.json() as Promise<DetectionResult>;
      })
      .then((saved) => {
        if (saved && saved.artworkId === selectedId && version === requestVersion.current) {
          setResult({ ...saved, mode: 'saved' });
        }
      })
      .catch(() => { /* Saved examples are optional. Live inference remains available. */ });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (showHow) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [showHow]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function findDogs() {
    if (!artwork || running) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    detectAbort.current = controller;
    setRunning(true);
    setError('');
    setActiveDetection(null);
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('/api/detect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id }), signal: controller.signal,
      });
      const payload = await response.json() as DetectionResult & { error?: { code: string; message: string } };
      if (!response.ok) throw new Error(response.status === 429 ? 'A few too many requests at once. Please wait a minute before trying again.' : payload.error?.message ?? 'Detection could not finish. Please try again in a moment.');
      if (version === requestVersion.current) {
        setResult({ ...payload, mode: 'live' });
        setShowBoxes(true);
      }
    } catch (failure) {
      if (version === requestVersion.current) {
        setError(failure instanceof Error && failure.name === 'AbortError'
          ? 'The model is taking longer than expected. Please try again in a moment.'
          : failure instanceof Error ? failure.message : 'Detection could not finish. Please try again.');
      }
    } finally {
      window.clearTimeout(timeout);
      if (version === requestVersion.current) setRunning(false);
    }
  }

  async function shareArtwork() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('share');
    } catch {
      setError('Copy the address from your browser to share this artwork.');
    }
  }

  function downloadResult() {
    if (!result || !artwork) return;
    const blob = new Blob([JSON.stringify({ ...result, artwork: { title: artwork.title, artist: artwork.artist, sourceUrl: artwork.sourceUrl }, displayThreshold: threshold }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dogs-in-the-details-${artwork.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    if (result.mode === 'live') recordLiveExport(artwork.id);
  }

  function moveArtwork(direction: number) {
    setSelectedId(artworks[(artworkIndex + direction + artworks.length) % artworks.length].id);
  }

  const exampleCode = [
    'curl -X POST https://dogs.zuchka.dev/api/detect \\',
    "  -H 'Content-Type: application/json' \\",
    `  -d '{"artworkId": ${artwork?.id ?? 27992}}'`,
  ].join('\n');

  return (
    <>
      <div className="page-shell">
        <header className="masthead">
          <a className="wordmark" href="/" aria-label="Dogs in the Details home"><span className="brand-mark"><ScanLine size={21} strokeWidth={1.6} /></span> DOGS IN THE DETAILS</a>
          <nav aria-label="Main navigation">
            <a href="#collection">The collection <ArrowDown size={13} /></a>
            <button onClick={() => setShowHow(true)}>How it works <ArrowUpRight size={14} /></button>
          </nav>
        </header>

        <main>
          <section className="introduction" aria-labelledby="page-title">
            <div>
              <p className="eyebrow"><span className="tiny-cross">+</span> A CLOSER LOOK AT ART, WITH COMPUTER VISION</p>
              <h1 id="page-title">Dogs in<br />the <em>Details.</em><span className="title-period" aria-hidden="true">*</span></h1>
            </div>
            <div className="intro-aside">
              <span className="edition-label">A SMALL EXPERIMENT IN LOOKING</span>
              <p>Old masters.<br />Very good dogs.</p>
              <div className="intro-description">Explore a painting. Let Roboflow’s RF-DETR find its canine companions. See what a model notices—and what it misses.</div>
              <a href="#collection" className="text-link">Look a little closer <ArrowDown size={15} /></a>
            </div>
          </section>

          <section id="collection" className="collection" aria-label="Interactive art collection">
            <div className="section-rule">
              <span><span className="section-number">01</span> THE LOOKING ROOM</span>
              <span className="collection-source">ART INSTITUTE OF CHICAGO <span className="separator">/</span> PUBLIC DOMAIN</span>
            </div>

            {manifestError ? (
              <div className="collection-error"><Info size={24} /><h2>The gallery is taking a moment.</h2><p>{manifestError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again <ArrowRight size={17} /></button></div>
            ) : !artwork ? (
              <div className="collection-loading"><LoaderCircle className="spin" size={24} /><span>Opening the collection…</span></div>
            ) : (
              <>
                <div className="workbench">
                  <div className="artwork-column">
                    <div className={`painting-mat ${running ? 'is-scanning' : ''}`}>
                      <div className="mat-topline"><span>PLATE {String(artworkIndex + 1).padStart(2, '0')}</span><button className="icon-button" onClick={shareArtwork} aria-label="Copy link to this artwork" title="Copy artwork link">{copied === 'share' ? <Check size={16} /> : <Share2 size={15} />}</button></div>
                      <div className="painting-space">
                        {!imageLoaded && !imageError && <span className="painting-loading"><LoaderCircle className="spin" size={22} /></span>}
                        {imageError ? <p className="painting-image-error">This painting could not be loaded. Choose another from the collection.</p> : (
                          <div className={`painting-stage ${imageLoaded ? 'is-loaded' : ''}`} style={{ '--art-ratio': artwork.width / artwork.height } as CSSProperties}>
                            <img key={artwork.id} src={artwork.image} alt={`${artwork.title}, ${artwork.date}, by ${artwork.artist}`} width={artwork.width} height={artwork.height} onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} />
                            {showBoxes && !running && dogs.map((dog, index) => (
                              <button key={dog.id} className={`detection-box ${activeDetection === dog.id ? 'is-active' : ''}`} style={{ left: `${dog.x * 100}%`, top: `${dog.y * 100}%`, width: `${dog.width * 100}%`, height: `${dog.height * 100}%` }} onClick={() => setActiveDetection(dog.id)} aria-label={`Dog ${index + 1}, ${Math.round(dog.confidence * 100)} percent confidence`}><span>{String(index + 1).padStart(2, '0')}</span></button>
                            ))}
                            {running && <div className="scanning-line" aria-hidden="true" />}
                          </div>
                        )}
                      </div>
                      <div className="mat-bottomline"><span>{running ? 'LOOKING FOR CANINE COMPANIONS…' : result ? `${dogs.length} ${dogs.length === 1 ? 'DETAIL' : 'DETAILS'} ABOVE ${Math.round(threshold * 100)}% CONFIDENCE` : 'EVERY PAINTING HAS MORE TO SEE'}</span><span className="mat-cross" aria-hidden="true">+</span></div>
                    </div>
                    <div className="painting-caption">
                      <div><h2>{artwork.title}</h2><p>{artwork.artist}<span> · </span>{artwork.date}</p></div>
                      <div className="artwork-paging"><button className="icon-button" onClick={() => moveArtwork(-1)} aria-label="Previous artwork"><ArrowLeft size={17} /></button><span>{String(artworkIndex + 1).padStart(2, '0')}<span className="page-count"> / {String(artworks.length).padStart(2, '0')}</span></span><button className="icon-button" onClick={() => moveArtwork(1)} aria-label="Next artwork"><ArrowRight size={17} /></button></div>
                    </div>
                  </div>

                  <aside className="inspection-panel" aria-label="Dog detection results">
                    <div className="panel-heading"><span className="eyebrow">THE DETAILS</span><span className={`model-indicator ${running ? 'is-busy' : ''}`}><span /> RF-DETR</span></div>
                    <div className="results-content" aria-live="polite" aria-busy={running}>
                      {running ? <div className="empty-state running-state"><span className="empty-state-icon"><Scan size={30} strokeWidth={1.2} /></span><h3>Taking a<br /><em>closer look.</em></h3><p>RF-DETR is looking for dogs in this painting. A first request can take a little longer.</p><div className="loading-dots"><span /><span /><span /></div></div> : result ? (
                        <>
                          <div className="results-summary"><h3>{dogs.length}<em>{dogs.length === 1 ? 'dog candidate' : 'dog candidates'}</em></h3><span className={`result-source ${result.mode === 'live' ? 'live' : ''}`}><span />{result.mode === 'saved' ? 'Saved Roboflow result' : 'Live Roboflow result'}</span></div>
                          {dogs.length ? <div className="dog-grid">{dogs.map((dog, index) => <button key={dog.id} className={`dog-card ${activeDetection === dog.id ? 'is-active' : ''}`} onClick={() => { setActiveDetection(dog.id); setShowBoxes(true); }} aria-label={`Highlight dog ${index + 1}`}><div className="crop-frame"><DogCrop artwork={artwork} detection={dog} /><span className="dog-number">{String(index + 1).padStart(2, '0')}</span><span className="crop-arrow"><ArrowUpRight size={15} /></span></div><span className="dog-card-caption"><span>Dog {String(index + 1).padStart(2, '0')}</span><span>{Math.round(dog.confidence * 100)}%</span></span></button>)}</div> : <div className="no-dogs"><Eye size={28} strokeWidth={1.2} /><p>{result.detections.length ? 'Try lowering the confidence threshold to reveal more candidates.' : 'No dogs detected in this painting. That’s a model result, not a guarantee—take a look yourself.'}</p></div>}
                          <p className="result-timestamp">{displayDate(result.generatedAt)}<span> · </span>{(result.durationMs / 1000).toFixed(1)}s inference</p>
                        </>
                      ) : <div className="empty-state"><span className="empty-state-icon"><Scan size={30} strokeWidth={1.2} /></span><h3>A familiar face,<br /><em>in an unexpected place.</em></h3><p>Sometimes center stage.<br />Sometimes hiding at the edge.<br />Let’s see who’s in this painting.</p></div>}
                    </div>

                    {result && !running && <div className="result-controls"><div className="confidence-label"><label htmlFor="confidence">Minimum confidence</label><output htmlFor="confidence">{Math.round(threshold * 100)}%</output></div><input id="confidence" type="range" min="10" max="95" step="5" value={Math.round(threshold * 100)} onChange={(event) => setThreshold(Number(event.target.value) / 100)} style={{ '--range-progress': `${((threshold * 100 - 10) / 85) * 100}%` } as CSSProperties} /><div className="result-actions"><button onClick={() => setShowBoxes(!showBoxes)} aria-pressed={showBoxes}>{showBoxes ? <Eye size={14} /> : <EyeOff size={14} />}{showBoxes ? 'Hide boxes' : 'Show boxes'}</button><button onClick={downloadResult}><ArrowDownToLine size={14} /> JSON</button></div></div>}

                    {error && <div className="inference-error" role="alert"><Info size={16} /><p>{error}{result && <span> The {result.mode} result above is from the previous successful run.</span>}</p></div>}
                    <div className="detect-action"><button className="primary-button" disabled={running || imageError} onClick={findDogs}>{running ? <><LoaderCircle className="spin" size={18} /> Looking closer…</> : <><ScanLine size={18} />{result ? 'Find the dogs again' : 'Find the dogs'}<ArrowRight size={17} /></>}</button><p>Live object detection, powered by <a href="https://roboflow.com" target="_blank" rel="noreferrer">Roboflow <ArrowUpRight size={10} /></a></p></div>
                  </aside>
                </div>

                <div className="collection-strip-heading"><span>ANOTHER PAINTING, ANOTHER POSSIBILITY</span><span>{artworks.length} WORKS TO EXPLORE</span></div>
                <div className="artwork-strip" aria-label="Choose an artwork">{artworks.map((item, index) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`artwork-card ${selectedId === item.id ? 'is-selected' : ''}`} aria-pressed={selectedId === item.id}><span className="thumbnail-wrap"><img src={item.image} alt="" loading="lazy" /><span className="thumbnail-number">{String(index + 1).padStart(2, '0')}</span>{selectedId === item.id && <span className="selected-label">ON VIEW <ArrowUpRight size={12} /></span>}</span><span className="artwork-card-title">{item.title}</span><span className="artwork-card-artist">{item.artist}</span></button>)}</div>

                <div className="artwork-credit"><span><span className="credit-dot" /> Public-domain art, open to everyone.</span><a href={artwork.sourceUrl} target="_blank" rel="noreferrer">View this work at the Art Institute of Chicago <ArrowUpRight size={13} /></a></div>
              </>
            )}
          </section>

          <section className="perspective" aria-label="About the experiment"><div className="perspective-label"><span className="section-number">02</span> A DIFFERENT KIND OF ART APPRECIATION</div><div><h2>A new way to notice<br /><em>what’s always been there.</em></h2><p>A model trained on everyday photographs meets centuries of painting. Some dogs are easy. Tiny, stylized, or partly hidden ones are harder. The interesting part is seeing where it works—and looking closely where it doesn’t.</p><button className="text-link" onClick={() => setShowHow(true)}>Go behind the details <ArrowUpRight size={15} /></button></div><span className="perspective-asterisk" aria-hidden="true">✳</span></section>
        </main>

        <footer className="footer"><span>DOGS IN THE DETAILS <span className="footer-divider">/</span> AN EXPERIMENT IN COMPUTER VISION</span><button onClick={() => setShowHow(true)}>Built with Roboflow <ArrowUpRight size={13} /></button></footer>
      </div>

      <dialog className="how-dialog" ref={dialogRef} onCancel={() => setShowHow(false)} onClick={(event) => { if (event.target === dialogRef.current) setShowHow(false); }}>
        <div className="dialog-content"><div className="dialog-top"><span className="eyebrow">BEHIND THE DETAILS</span><button className="icon-button" onClick={() => setShowHow(false)} aria-label="Close explanation"><X size={20} /></button></div><h2>Art. An API.<br /><em>A fresh pair of eyes.</em></h2><p className="dialog-intro">This is object detection: finding a dog and drawing a box around it. The model predicts locations and confidence scores, not pixel-perfect segmentation or an art-historical interpretation.</p><ol className="how-steps"><li><span>01</span><div><h3>Start with an open collection</h3><p>Public-domain paintings and their metadata come from the Art Institute of Chicago. Each painting links back to its original museum record.</p></div></li><li><span>02</span><div><h3>Let Roboflow run the model</h3><p>Our server sends the selected painting to Roboflow’s hosted RF-DETR object detector. The API key stays on the server. We keep the predictions labeled “dog.”</p></div></li><li><span>03</span><div><h3>Make the predictions visible</h3><p>Boxes locate each candidate. Crops let you inspect it. The confidence slider filters the returned predictions locally, without another model request.</p></div></li></ol><div className="developer-note"><Code2 size={19} /><div><h3>Try the demo API</h3><p>The same endpoint powers this page. Choose an artwork ID from the collection and inspect the JSON response.</p></div></div><div className="code-block"><button aria-label="Copy API example" onClick={async () => { try { await navigator.clipboard.writeText(exampleCode); setCopied('code'); } catch { /* The code remains selectable. */ } }}>{copied === 'code' ? <Check size={15} /> : <Copy size={15} />}</button><pre>{exampleCode}</pre></div><p className="model-caveat"><Info size={15} /><span>Confidence is a model score, not a promise of correctness. RF-DETR was trained on photographs; paintings can produce missed dogs and false positives. Saved examples are labeled with their original run date.</span></p><a className="text-link" href="https://docs.roboflow.com/models/supported-models/rf-detr" target="_blank" rel="noreferrer">Explore RF-DETR on Roboflow <ChevronRight size={15} /></a><a className="source-download" href="/dogs-in-the-details-source.zip" download><ArrowDownToLine size={15} /> Download the project source</a></div>
      </dialog>
    </>
  );
}

export default App;
