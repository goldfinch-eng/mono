import { initializeConnector } from "@web3-react/core";
import { WalletConnect } from "@web3-react/walletconnect";

import { DESIRED_CHAIN_ID } from "@/constants";

import { RPC_URLS } from "../chains";

export const [walletConnect, walletConnectHooks] =
  initializeConnector<WalletConnect>(
    (actions) => new WalletConnect(actions, { rpc: RPC_URLS }),
    [DESIRED_CHAIN_ID]
  );
