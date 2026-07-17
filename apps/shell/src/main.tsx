import '@ewm/design-tokens/fonts.css';
import '@ewm/design-tokens/tokens.css';
import { createHashUrlStateBus } from '@ewm/core-state';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { createFixtureScenario } from './fixtures.js';
import './styles.css';

const container = document.getElementById('root');
if (container) {
  const scenario = createFixtureScenario('active');
  createRoot(container).render(
    <StrictMode>
      <App {...scenario} urlBus={createHashUrlStateBus(window)} />
    </StrictMode>,
  );
}
