import { describe, expect, it } from 'vitest';
import {
  normalizeCapAlert,
  normalizeCertainty,
  normalizeSeverity,
  normalizeUrgency,
} from './index.js';

describe('enum normalization', () => {
  it('lowercases the CAP title-case vocabulary', () => {
    expect(normalizeSeverity('Severe')).toBe('severe');
    expect(normalizeUrgency('Immediate')).toBe('immediate');
    expect(normalizeCertainty('Likely')).toBe('likely');
  });

  it('maps absent or junk values to unknown instead of guessing', () => {
    expect(normalizeSeverity(undefined)).toBe('unknown');
    expect(normalizeSeverity(null)).toBe('unknown');
    expect(normalizeSeverity('CATASTROPHIC')).toBe('unknown');
    expect(normalizeUrgency('  ')).toBe('unknown');
  });
});

describe('normalizeCapAlert', () => {
  // Shaped like the properties of an api.weather.gov alert feature.
  const nwsShaped = {
    id: 'urn:oid:2.49.0.1.840.0.demo',
    sender: 'w-nws.webmaster@noaa.gov',
    sent: '2026-07-14T10:00:00-07:00',
    event: 'Flood Warning',
    headline: 'Flood Warning issued for the Example River',
    severity: 'Severe',
    urgency: 'Expected',
    certainty: 'Likely',
    effective: '2026-07-14T10:00:00-07:00',
    expires: '2026-07-15T10:00:00-07:00',
    areaDesc: 'Example County',
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  };

  // Shaped like an ECCC CAP <info> block projection; note the missing
  // optional fields ECCC frequently omits.
  const ecccShaped = {
    id: 'urn:oid:2.49.0.1.124.demo',
    sender: 'cap-pac@canada.ca',
    sent: '2026-07-14T17:00:00Z',
    event: 'Rainfall Warning',
    severity: 'Moderate',
    urgency: 'Future',
    certainty: 'Possible',
    expires: null,
    geometry: null,
  };

  it('normalizes an NWS-shaped alert', () => {
    const alert = normalizeCapAlert(nwsShaped, 'us');
    expect(alert.id).toBe('us:urn:oid:2.49.0.1.840.0.demo');
    expect(alert.sourceRegion).toBe('us');
    expect(alert.severity).toBe('severe');
    expect(alert.expires).toBe('2026-07-15T10:00:00-07:00');
    expect(alert.geometry?.type).toBe('Polygon');
  });

  it('normalizes an ECCC-shaped alert with sparse fields', () => {
    const alert = normalizeCapAlert(ecccShaped, 'ca');
    expect(alert.id).toBe('ca:urn:oid:2.49.0.1.124.demo');
    expect(alert.sourceRegion).toBe('ca');
    expect(alert.effective).toBe(alert.sent); // defaulted
    expect(alert.expires).toBeNull();
    expect(alert.geometry).toBeNull();
    expect(alert.headline).toBeUndefined();
  });

  it('rejects alerts missing identity fields', () => {
    expect(() => normalizeCapAlert({ ...nwsShaped, id: '' }, 'us')).toThrow(/"id"/);
    expect(() => normalizeCapAlert({ ...nwsShaped, sent: 'sometime' }, 'us')).toThrow(/parseable/);
  });

  it('preserves the raw payload for audit when provided', () => {
    const raw = { original: true };
    const alert = normalizeCapAlert({ ...ecccShaped, raw }, 'ca');
    expect(alert.raw).toBe(raw);
  });
});
