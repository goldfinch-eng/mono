import {
  Web3ReactProvider,
  Web3ReactHooks,
  useWeb3React,
} from "@web3-react/core";
import { MetaMask } from "@web3-react/metamask";
import { WalletConnect } from "@web3-react/walletconnect";
import { ReactNode } from "react";

import { metaMask, metaMaskHooks } from "./connectors/metamask";
import { walletConnect, walletConnectHooks } from "./connectors/walletconnect";

export const connectorPriorityList: [
  MetaMask | WalletConnect,
  Web3ReactHooks
][] = [
  [metaMask, metaMaskHooks],
  [walletConnect, walletConnectHooks],
];

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <Web3ReactProvider connectors={connectorPriorityList}>
      {children}
    </Web3ReactProvider>
  );
}

export function useWallet() {
  return useWeb3React();
}

//! Eager connection unfortunately is bugged at this time (https://github.com/NoahZinsmeister/web3-react/issues/544). When the issue is eventually fixed, this function can be run in a side effect to invoke eager connections.
export async function connectEagerly() {
  for (const [connector] of connectorPriorityList) {
    await connector.connectEagerly();
  }
}
