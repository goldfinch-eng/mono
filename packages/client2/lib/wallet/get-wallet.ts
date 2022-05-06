import { MetaMask } from "@web3-react/metamask";
import { WalletConnect } from "@web3-react/walletconnect";
import { ethers } from "ethers";

import { connectorPriorityList } from "./use-wallet";

/**
 * This is meant to be used in areas of the codebase where you don't have access to the React tree (for example, in an Apollo local resolver).
 * Please don't use this function if you have access to the `useWallet()` hook.
 * @returns An instance of ethers Web3Provider wrapping the user's connected wallet. If no wallet is connected, this will return null.
 */
export function getProvider() {
  for (const [connector] of connectorPriorityList) {
    if (connector instanceof MetaMask && connector.provider?.isConnected) {
      return new ethers.providers.Web3Provider(connector.provider);
    } else if (
      connector instanceof WalletConnect &&
      connector.provider &&
      connector.provider.connected
    ) {
      return new ethers.providers.Web3Provider(connector.provider);
    } else if (connector.provider) {
      return new ethers.providers.Web3Provider(connector.provider);
    }
  }
  return null;
}
