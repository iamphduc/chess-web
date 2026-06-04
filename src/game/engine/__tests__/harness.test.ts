import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('sanity check: arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
