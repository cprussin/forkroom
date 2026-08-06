import { expect, spyOn } from "bun:test";

/**
 * Run a render that is expected to throw and be caught by a React error
 * boundary. React reports the caught error through `console.error`, which would
 * otherwise print a stack trace alongside the suite's green summary. Capture
 * that call for the duration of the render and assert it happened — so the
 * intentional error path stays verified rather than merely silenced — then
 * restore the real `console.error`. Renders that don't throw are unaffected, so
 * a genuine unexpected `console.error` still surfaces.
 */
export const expectCaughtErrorLogged = (renderThrowing: () => void): void => {
  const errorLog = spyOn(console, "error").mockImplementation(() => undefined);
  try {
    renderThrowing();
    expect(errorLog).toHaveBeenCalled();
  } finally {
    errorLog.mockRestore();
  }
};
