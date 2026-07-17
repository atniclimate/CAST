import { createRoot } from 'react-dom/client';

// Placeholder entry: the SHIELD shell (URL-owned selection, four-card grid,
// hero, honest-status presentations) is built by the wave-1 shield-shell lane.
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<p>SHIELD is under construction.</p>);
}
