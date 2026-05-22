import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import { initDB } from './app/services/db';
import { initPaperStore } from './app/services/pdfService';
import { initSourceStore } from './app/services/sourceService';

async function bootstrap() {
  try {
    const { papers, sources } = await initDB();
    initPaperStore(papers);
    initSourceStore(sources);
  } catch (e) {
    // IndexedDB unavailable (private browsing on some browsers) — app
    // still works with empty caches; writes will fail silently.
    console.warn('[DB] IndexedDB init failed, running with empty stores:', e);
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

bootstrap();
