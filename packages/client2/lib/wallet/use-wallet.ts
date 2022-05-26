import { getPriorityConnector } from "@web3-react/core";

import { metaMask, metaMaskHooks } from "./connectors/metamask";
import { walletConnect, walletConnectHooks } from "./connectors/walletconnect";

// This hook basically runs through the given connectors and returns the first one that's actually connected
// In this case we're telling it to prioritize MetaMask, then WalletConnect
const {
  usePriorityConnector,
  usePriorityProvider,
  usePriorityAccount,
  usePriorityIsActive,
  usePriorityError,
  usePriorityChainId,
} = getPriorityConnector(
  [metaMask, metaMaskHooks],
  [walletConnect, walletConnectHooks]
);

// Note: tried to use nominal typing here, but it doesn't work very well because web3-react doesn't guarantee that provider is undefined when isActive is true
export function useWallet() {
  return {
    isActive: usePriorityIsActive(),
    connector: usePriorityConnector(),
    provider: usePriorityProvider(),
    account: usePriorityAccount(),
    chainId: usePriorityChainId(),
    error: usePriorityError(),
  };
}
