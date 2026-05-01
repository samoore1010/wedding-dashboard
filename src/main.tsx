import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { getWeddingIdFromPath, newWeddingId } from './cloudStorage';

// In production:
//   - First visit ever (no localStorage memory): generate /w/<id> and redirect.
//   - Bare URL on a returning browser: redirect to the last /w/<id> we saw,
//     so bookmarks like "yourapp.up.railway.app" come back to the same wedding.
//   - On any /w/<id> page: remember that id so bare URLs work next time.
// In dev (`npm run dev`) there's no API server, so we always fall through to
// localStorage-backed state and never redirect.
const LAST_ID_KEY = 'wedding-dashboard:lastId';
const currentId = getWeddingIdFromPath();

if (import.meta.env.PROD && !currentId) {
  let id = localStorage.getItem(LAST_ID_KEY);
  if (!id) {
    id = newWeddingId();
    localStorage.setItem(LAST_ID_KEY, id);
  }
  window.location.replace(`/w/${id}`);
} else {
  if (import.meta.env.PROD && currentId) {
    localStorage.setItem(LAST_ID_KEY, currentId);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
