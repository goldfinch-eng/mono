import { CoinbaseWallet } from "@web3-react/coinbase-wallet";
import {
  Web3ReactProvider,
  Web3ReactHooks,
  useWeb3React,
} from "@web3-react/core";
import { MetaMask } from "@web3-react/metamask";
import { Network } from "@web3-react/network";
import { WalletConnect } from "@web3-react/walletconnect";
import { ReactNode } from "react";

import {
  coinbaseWallet,
  coinbaseWalletHooks,
} from "./connectors/coinbase-wallet";
import { metaMask, metaMaskHooks } from "./connectors/metamask";
import { network, networkHooks } from "./connectors/network";
import { walletConnect, walletConnectHooks } from "./connectors/walletconnect";

export const connectorPriorityList: [
  MetaMask | WalletConnect | CoinbaseWallet | Network,
  Web3ReactHooks
][] = [
  [metaMask, metaMaskHooks],
  [walletConnect, walletConnectHooks],
  [coinbaseWallet, coinbaseWalletHooks],
  [network, networkHooks],
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

export async function connectEagerly() {
  for (const [connector] of connectorPriorityList) {
    if (connector instanceof Network) {
      connector.activate();
    } else {
      await connector.connectEagerly?.();
    }
  }
}
