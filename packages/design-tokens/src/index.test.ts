import { describe, expect, it } from 'vitest';

import {
  bodyAnchor,
  color,
  deckTextFloorPx,
  program,
  radius,
  ruleHeavy,
  semantic,
  surfaceDark,
  typeScale,
  typeSize,
} from './index.js';

const HEX = /^#[0-9A-F]{6}$/i;

describe('color tokens', () => {
  it('every palette value is a six-digit hex color', () => {
    for (const palette of [color, surfaceDark, program, semantic]) {
      for (const [name, value] of Object.entries(palette)) {
        expect(value, name).toMatch(HEX);
      }
    }
  });

  it('the page ground is the rich near-black, never pure black', () => {
    expect(color.blackBg).toBe('#010B13');
    expect(surfaceDark.base).toBe('#010B13');
  });

  it('the dark surface ladder lightens as it rises', () => {
    const luminance = (hex: string): number =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(luminance(surfaceDark.raised)).toBeGreaterThan(luminance(surfaceDark.base));
    expect(luminance(surfaceDark.overlay)).toBeGreaterThan(luminance(surfaceDark.raised));
  });

  it('resolves the handoff Grey Element name collision per its recommendation', () => {
    expect(surfaceDark.raised).toBe('#141414');
    expect(ruleHeavy).toBe('#141414');
    expect(program.programGrey).toBe('#98A1B4');
  });
});

describe('type scale', () => {
  it('matches the handoff web sizes at the 16px anchor', () => {
    expect(typeSize('title', 'web')).toBeCloseTo(40.8);
    expect(typeSize('heading1', 'web')).toBe(36);
    expect(typeSize('heading2', 'web')).toBe(28);
    expect(typeSize('subtitle', 'web')).toBe(20);
    expect(typeSize('quote', 'web')).toBe(21);
    expect(typeSize('body', 'web')).toBe(16);
    expect(typeSize('caption', 'web')).toBe(13);
  });

  it('matches the handoff document sizes at the 12pt anchor', () => {
    expect(typeSize('title', 'document')).toBeCloseTo(30.6);
    expect(typeSize('heading1', 'document')).toBe(27);
    expect(typeSize('body', 'document')).toBe(12);
  });

  it('floors deck text at the 24px slide-text minimum', () => {
    expect(typeSize('caption', 'deck')).toBe(deckTextFloorPx);
    expect(typeScale.caption.ratio * bodyAnchor.deck).toBeLessThan(deckTextFloorPx);
    expect(typeSize('body', 'deck')).toBe(28);
  });

  it('display styles are tracked tight and body is never tracked', () => {
    expect(typeScale.title.tracking).toBe(-0.025);
    expect(typeScale.heading1.tracking).toBe(-0.025);
    expect(typeScale.body.tracking).toBe(0);
    expect(typeScale.caption.tracking).toBe(0);
  });
});

describe('shape', () => {
  it('all edges are square', () => {
    expect(radius).toBe(0);
  });
});
