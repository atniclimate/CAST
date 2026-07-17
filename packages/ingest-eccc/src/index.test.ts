import { describe, expect, it } from 'vitest';

import { PACKAGE_STATE } from './index.js';

describe('ingest-eccc skeleton', () => {
  it('is the pre-lane skeleton', () => {
    expect(PACKAGE_STATE).toBe('skeleton-awaiting-wave-1c');
  });
});
