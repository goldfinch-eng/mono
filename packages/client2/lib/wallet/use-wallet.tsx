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
