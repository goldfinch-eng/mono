import { useEffect } from "react";

import { connectEagerly } from "../wallet";

/**
 * Side effects that should run on the client as the app initializes
 */
export function useAppInitialization() {
  useEffect(() => {
    connectEagerly();
  }, []);
}
