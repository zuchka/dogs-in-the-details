import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, FileText, Github, PawPrint, Video } from 'lucide-react';
import launchNoteMarkdown from '../docs/launch-note.md?raw';
import { walkthroughVideo } from './assessment-video';
import './assessment.css';

const repository = 'https://github.com/zuchka/dogs-in-the-details';
const launchNote = launchNoteMarkdown.replace(/^# .+\r?\n\s*/, '').trim();
const noteParagraphs = launchNote.split(/\r?\n\s*\r?\n/);
const wordCount = launchNote.split(/\s+/).length;

export default function Assessment() {
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    document.title = 'The assessment — Dogs in the Details';
  }, []);

  return (
    <div className="assessment-page">
      <a className="assessment-skip" href="#assessment-main">Skip to deliverables</a>
      <header className="assessment-header">
        <a className="wordmark" href="/" aria-label="Dogs in the Details home">
          <PawPrint size={23} strokeWidth={1.5} className="brand-mark" aria-hidden="true" />
          <span>DOGS IN THE DETAILS</span>
        </a>
        <a className="assessment-header-link" href={repository} aria-label="View source code on GitHub">
          <Github size={17} aria-hidden="true" /><span>Source code</span><ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </header>

      <main id="assessment-main">
        <section className="assessment-intro" aria-labelledby="assessment-title">
          <p className="assessment-kicker">ROBOFLOW · DEVELOPER ADVOCATE ASSESSMENT</p>
          <div className="assessment-intro-grid">
            <h1 id="assessment-title">A closer look<br />at the <em>build.</em></h1>
            <div className="assessment-intro-aside">
              <p>Computer vision meets<br />the museum collection.</p>
              <span>A working project, a developer walkthrough, and a plan to help the right people try it.</span>
            </div>
          </div>
          <nav className="assessment-index" aria-label="Deliverables">
            <a href="#demo"><span>01</span> The demo <ArrowDown size={14} aria-hidden="true" /></a>
            <a href="#walkthrough"><span>02</span> The walkthrough <ArrowDown size={14} aria-hidden="true" /></a>
            <a href="#launch-note"><span>03</span> Launch & feedback <ArrowDown size={14} aria-hidden="true" /></a>
          </nav>
        </section>

        <section className="assessment-section" id="demo" aria-labelledby="demo-heading">
          <div className="assessment-section-label"><span>01</span><h2 id="demo-heading">The working demo</h2></div>
          <div className="assessment-demo-card">
            <a className="assessment-artwork" href="/?artwork=886&mode=segmentation#collection" aria-label="Inspect Three Little Girls with dog outlines in the demo">
              <img src="/images/886.jpg" alt="Three Little Girls by Narcisse Virgile Diaz de la Peña, a painting with dogs to inspect" width="843" height="1241" />
              <span>LOOK A LITTLE CLOSER <ArrowUpRight size={16} aria-hidden="true" /></span>
            </a>
            <div className="assessment-demo-copy">
              <p className="assessment-kicker">40 PAINTINGS. A FEW HIDDEN COMPANIONS.</p>
              <h3>Dogs in the <em>Details.</em></h3>
              <p>Find dogs in public-domain art, inspect their boxes or outlines, and export the coordinates. Or bring a painting of your own.</p>
              <p>Powered by COCO-pretrained RF-DETR models on Roboflow Serverless. No custom training or text prompt.</p>
              <div className="assessment-actions">
                <a className="assessment-primary" href="/?artwork=886&mode=segmentation#collection">Explore the demo <ArrowRight size={16} aria-hidden="true" /></a>
                <a className="assessment-text-link" href={repository}><Github size={16} aria-hidden="true" /> Get the code</a>
              </div>
              <a className="assessment-small-link" href={`${repository}#run-a-prediction-in-one-command`}>Reproduce a prediction in one command <ArrowUpRight size={13} aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section className="assessment-section" id="walkthrough" aria-labelledby="walkthrough-heading">
          <div className="assessment-section-label"><span>02</span><h2 id="walkthrough-heading">The developer walkthrough</h2></div>
          <div className="assessment-video-layout">
            <div className="assessment-video-area">
              {walkthroughVideo.src ? (
                <>
                  <video controls playsInline preload="metadata" aria-label="Dogs in the Details developer walkthrough" onError={() => setVideoError(true)}>
                    <source src={walkthroughVideo.src} type="video/mp4" />
                    {walkthroughVideo.captionsSrc && <track kind="captions" src={walkthroughVideo.captionsSrc} srcLang="en" label="English" default />}
                    Your browser cannot play this video. Use the MP4 link below.
                  </video>
                  {videoError && <p className="assessment-video-error" role="status">The video could not load. Try the direct MP4 link below.</p>}
                </>
              ) : (
                <div className="assessment-video-pending">
                  <Video size={34} strokeWidth={1.2} aria-hidden="true" />
                  <p>Next up: the walkthrough.</p>
                  <span>The recording has not been published yet.<br />It will be playable right here.</span>
                  <span className="assessment-status">AWAITING RECORDING</span>
                </div>
              )}
            </div>
            <div className="assessment-video-copy">
              <p className="assessment-kicker">FROM PAINTING TO PREDICTION</p>
              <h3>See how<br />it works.</h3>
              <p>A short tour of the interface, what RF-DETR returns, and how to run the same hosted model from a terminal.</p>
              <a className="assessment-text-link" href={`${repository}/blob/main/docs/walkthrough.md`}><FileText size={16} aria-hidden="true" /> Read the walkthrough script</a>
              {walkthroughVideo.src && <a className="assessment-text-link" href={walkthroughVideo.src}>Open the MP4 <ArrowUpRight size={14} aria-hidden="true" /></a>}
            </div>
          </div>
        </section>

        <section className="assessment-section" id="launch-note" aria-labelledby="note-heading">
          <div className="assessment-section-label"><span>03</span><h2 id="note-heading">Launch & feedback</h2><span className="assessment-word-count">{wordCount} / 200 WORDS</span></div>
          <div className="assessment-note-layout">
            <aside>
              <p className="assessment-kicker">THE RIGHT AUDIENCE</p>
              <h3>For people<br />building access<br />to collections.</h3>
              <a className="assessment-small-link" href="https://wiki.code4lib.org/MailingList">About the Code4Lib mailing list <ArrowUpRight size={13} aria-hidden="true" /></a>
            </aside>
            <article className="assessment-note" aria-label="Launch and feedback note">
              {noteParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          </div>
        </section>
      </main>

      <footer className="assessment-footer">
        <span>A small experiment in looking closer.</span>
        <a href="/">Back to the collection <ArrowRight size={14} aria-hidden="true" /></a>
      </footer>
    </div>
  );
}
