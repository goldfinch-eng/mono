/**
 * Simple helper that provides a convenient way to wait for n milliseconds in an async function.
 */
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
