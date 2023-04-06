import { ethers } from "ethers";

import { DESIRED_CHAIN_ID } from "@/constants";

import { RPC_URLS } from "./chains";
import { connectorPriorityList } from "./use-wallet";

/**
 * This is meant to be used in areas of the codebase where you don't have access to the React tree (for example, in an Apollo local resolver).
 * Please don't use this function if you have access to the `useWallet()` hook.
 * @returns An instance of ethers Web3Provider wrapping the user's connected wallet. If no wallet is connected, this will return null.
 */
export async function getProvider() {
  for (const [connector] of connectorPriorityList) {
    if (connector.provider) {
      // ! There's a really annoying bug that stems from wallet eager connection. When the eager connection is attempted, provider.isConnected will wrongly be set to true, even though nothing is actually connected
      // ! The false connection causes havoc so we need to do a catch for it here by checking to see if `getAddress()` will succeed.
      // ! This will probably go away when this issue is fixed: https://github.com/NoahZinsmeister/web3-react/issues/544
      try {
        const web3Provider = new ethers.providers.Web3Provider(
          // @ts-expect-error CoinbaseWalletProvider apparently has types that don't fully overlap. It's probably just a type issue, seems OK at runtime.
          connector.provider
        );
        await web3Provider.getSigner().getAddress();
        return web3Provider;
      } catch (e) {
        continue;
      }
    }
  }
  return getFreshProvider();
}

export function getFreshProvider() {
  return new ethers.providers.JsonRpcProvider(
    RPC_URLS[DESIRED_CHAIN_ID],
    DESIRED_CHAIN_ID
  );
}

// TODO yarn patch this to make the batching invervals longer than 10ms
export const batchProvider = new ethers.providers.JsonRpcBatchProvider(
  RPC_URLS[DESIRED_CHAIN_ID],
  DESIRED_CHAIN_ID
);
