import { getPriorityConnector } from "@web3-react/core";

import { metaMask, hooks } from "./connectors/metamask";

export function useWallet() {
  const {
    usePriorityConnector,
    usePriorityProvider,
    usePriorityAccount,
    usePriorityIsActive,
    usePriorityError,
  } = getPriorityConnector([metaMask, hooks]);

  return {
    connector: usePriorityConnector(),
    provider: usePriorityProvider(),
    account: usePriorityAccount(),
    isActive: usePriorityIsActive(),
    error: usePriorityError(),
  };
}
