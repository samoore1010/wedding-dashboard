import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { getWeddingIdFromPath, newWeddingId } from './cloudStorage';

// In production, every visitor needs a /w/<id> URL. Anyone arriving at "/"
// (or any other path) gets a fresh id assigned and redirected.
// In dev (`npm run dev`), there's no API server, so we fall through to
// localStorage and never redirect.
if (import.meta.env.PROD && !getWeddingIdFromPath()) {
  const id = newWeddingId();
  window.location.replace(`/w/${id}`);
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
