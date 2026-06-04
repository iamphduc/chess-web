// Harness sanity test — verifies the test runner discovers and executes this suite.
// No chess logic here; this is wiring only.

export {};

const HARNESS_VERSION = 1;

describe('harness', () => {
  it('runner is wired and the suite is green', () => {
    expect(HARNESS_VERSION).toBe(1);
  });
});
