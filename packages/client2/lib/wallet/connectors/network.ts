import { initializeConnector } from "@web3-react/core";
import { Network } from "@web3-react/network";

import { RPC_URLS } from "../chains";

export const [network, networkHooks] = initializeConnector<Network>(
  (actions) => new Network(actions, RPC_URLS)
);
