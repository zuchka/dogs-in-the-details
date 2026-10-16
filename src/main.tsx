import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Assessment from './Assessment';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{/^\/assessment\/?$/.test(window.location.pathname) ? <Assessment /> : <App />}</StrictMode>,
);
