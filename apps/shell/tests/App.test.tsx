import type { NormalizedAlert } from '@ewm/alerts-schema';
import { createMemoryUrlStateBus, serializeViewState } from '@ewm/core-state';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import {
  ACTIVE_SEVERE_ALERT,
  FIXTURE_NATION_IDS,
  createFixtureScenario,
} from '../src/fixtures.js';
import { selectHeroAlert } from '../src/logic.js';

function renderScenario(
  scenarioName: 'active' | 'unavailable' | 'quiet',
  nationId?: string,
): string {
  const scenario = createFixtureScenario(scenarioName);
  const urlBus = createMemoryUrlStateBus(
    serializeViewState({ center: [-120.5, 47.25], zoom: 4, nation: nationId }),
  );
  return renderToStaticMarkup(<App {...scenario} urlBus={urlBus} />);
}

describe('URL-owned Nation selection and T1 contact gate', () => {
  it('renders no contacts without the n key', () => {
    const markup = renderScenario('active');
    expect(markup).not.toContain('Cedar Fixture Emergency Office');
    expect(markup).not.toContain('Role-based fixture contacts');
  });

  it('renders attributed role-based contacts when n is present', () => {
    const markup = renderScenario('active', FIXTURE_NATION_IDS.cedar);
    expect(markup).toContain('Cedar Fixture Emergency Office');
    expect(markup).toContain('Fictional public office directory fixture');
  });
});

describe('quiet eligibility', () => {
  it('renders the three-part quiet state only for a genuinely quiet snapshot', () => {
    const markup = renderScenario('quiet', FIXTURE_NATION_IDS.river);
    expect(markup).toContain('Conditions normal in the fixture snapshot');
    expect(markup).toContain('Seasonal preparedness');
    expect(markup).toContain('Ambient conditions');
  });

  it('withholds the all-clear when a required source is unavailable', () => {
    const markup = renderScenario('unavailable');
    expect(markup).not.toContain('Conditions normal in the fixture snapshot');
    expect(markup).toContain('Conditions cannot be confirmed');
    expect(markup).toContain('fixture-severe: unavailable');
  });
});

describe('hero selection', () => {
  it('selects the highest active band across modules', () => {
    const moderate: NormalizedAlert = {
      ...ACTIVE_SEVERE_ALERT,
      alertId: 'fixture-agency:moderate-hero-test',
      eventId: 'fixture-event:moderate-hero-test',
      sourceId: 'fixture-hydro',
      band: 'moderate',
    };
    const extreme: NormalizedAlert = {
      ...ACTIVE_SEVERE_ALERT,
      alertId: 'fixture-agency:extreme-hero-test',
      eventId: 'fixture-event:extreme-hero-test',
      sourceId: 'fixture-winter',
      band: 'extreme',
    };
    expect(selectHeroAlert([moderate, ACTIVE_SEVERE_ALERT, extreme])?.alertId).toBe(extreme.alertId);
  });
});
