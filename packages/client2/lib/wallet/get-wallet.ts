import type { Web3Provider } from "@ethersproject/providers";
import { MetaMask } from "@web3-react/metamask";
import { WalletConnect } from "@web3-react/walletconnect";
import { ethers } from "ethers";

import { connectorPriorityList } from "./use-wallet";

/**
 * This is meant to be used in areas of the codebase where you don't have access to the React tree (for example, in an Apollo local resolver).
 * Please don't use this function if you have access to the `useWallet()` hook.
 * @returns An instance of ethers Web3Provider wrapping the user's connected wallet. If no wallet is connected, this will return null.
 */
export async function getProvider(): Promise<Web3Provider | null> {
  let web3Provider: Web3Provider | null = null;
  for (const [connector] of connectorPriorityList) {
    if (connector instanceof MetaMask && connector.provider?.isConnected?.()) {
      web3Provider = new ethers.providers.Web3Provider(connector.provider);
    } else if (
      connector instanceof WalletConnect &&
      connector.provider &&
      connector.provider.connected
    ) {
      web3Provider = new ethers.providers.Web3Provider(connector.provider);
    } else if (connector.provider) {
      web3Provider = new ethers.providers.Web3Provider(connector.provider);
    }
  }

  // There's a really annoying bug that stems from wallet eager connection. When the eager connection is attempted, provider.isConnected will falsely be set to true, even though nothing is actually connected
  // The false connection causes havoc so we need to do a catch for it here by checking to see if `getAddress()` will succeed.
  if (web3Provider) {
    try {
      await web3Provider.getSigner().getAddress();
    } catch (e) {
      return null;
    }
  }

  return web3Provider;
}
