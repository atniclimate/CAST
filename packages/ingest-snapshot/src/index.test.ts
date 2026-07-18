import { describe, expect, it } from 'vitest';

import { INGEST_SNAPSHOT_PACKAGE } from './index.js';

describe('@ewm/ingest-snapshot skeleton', () => {
  it('exports the package marker', () => {
    expect(INGEST_SNAPSHOT_PACKAGE).toBe('@ewm/ingest-snapshot');
  });
});
