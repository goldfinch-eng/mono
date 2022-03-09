import { getPriorityConnector } from "@web3-react/core";

import { metaMask, metaMaskHooks } from "./connectors/metamask";
import { walletConnect, walletConnectHooks } from "./connectors/walletconnect";

export function useWallet() {
  // This hook basically runs through the given connectors and returns the first one that's actually connected
  // In this case we're telling it to prioritize MetaMask, then WalletConnect
  const {
    usePriorityConnector,
    usePriorityProvider,
    usePriorityAccount,
    usePriorityIsActive,
    usePriorityError,
  } = getPriorityConnector(
    [metaMask, metaMaskHooks],
    [walletConnect, walletConnectHooks]
  );

  return {
    connector: usePriorityConnector(),
    provider: usePriorityProvider(),
    account: usePriorityAccount(),
    isActive: usePriorityIsActive(),
    error: usePriorityError(),
  };
}
