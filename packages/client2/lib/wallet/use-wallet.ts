import type { Web3Provider } from "@ethersproject/providers";
import { getPriorityConnector } from "@web3-react/core";
import type { Connector } from "@web3-react/types";

import { metaMask, metaMaskHooks } from "./connectors/metamask";
import { walletConnect, walletConnectHooks } from "./connectors/walletconnect";

export function useWallet():
  | {
      isActive: false;
      connector: Connector;
      provider: undefined;
      account: undefined;
      chainId: undefined;
      error: Error | undefined;
    }
  | {
      isActive: true;
      connector: Connector;
      provider: Web3Provider;
      account: string;
      chainId: number;
      error: Error | undefined;
    } {
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

  const connector = usePriorityConnector();
  const provider = usePriorityProvider();
  const account = usePriorityAccount();
  const chainId = usePriorityChainId();
  const isActive = usePriorityIsActive();
  const error = usePriorityError();

  if (isActive) {
    return {
      isActive: true,
      connector,
      provider: provider as Web3Provider,
      account: account as string,
      chainId: chainId as number,
      error,
    };
  }
  return {
    isActive: false,
    connector,
    provider: undefined,
    account: undefined,
    chainId: undefined,
    error,
  };
}
