import { useState, useEffect } from "react";

/**
 * This hook is useful for conditional rendering involving `account` from wagmi. This is important because `account` will be populated on the first frame in the client, but not on the server.
 * This can potentially lead to hydration issues, so you can use this hook to ensure that content conditional on account is not rendered on the first frame.
 * Wagmi might make it such that the server-rendering step can become aware of the user's `account` in the future, in which case we may integrate it properly with SSR and reevaluate use of this hook.
 * https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
 *
 * @returns boolean `true` if this component is mounted, meaning that it's rendered and hydrated on the client.
 */
export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  return isMounted;
}
