import { initializeConnector } from "@web3-react/core";
import { WalletConnect } from "@web3-react/walletconnect";

import { ALLOWED_CHAIN_IDS, RPC_URLS } from "../chains";

export const [walletConnect, walletConnectHooks] =
  initializeConnector<WalletConnect>(
    (actions) => new WalletConnect(actions, { rpc: RPC_URLS }),
    ALLOWED_CHAIN_IDS
  );
