import { initializeConnector } from "@web3-react/core";
import { MetaMask } from "@web3-react/metamask";

import { DESIRED_CHAIN_ID } from "@/constants";

export const [metaMask, metaMaskHooks] = initializeConnector<MetaMask>(
  (actions) => new MetaMask(actions),
  [DESIRED_CHAIN_ID]
);
