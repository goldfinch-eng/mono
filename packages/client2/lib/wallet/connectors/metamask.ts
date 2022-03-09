import { initializeConnector } from "@web3-react/core";
import { MetaMask } from "@web3-react/metamask";

import { ALLOWED_CHAIN_IDS } from "../chains";

export const [metaMask, hooks] = initializeConnector<MetaMask>(
  (actions) => new MetaMask(actions),
  ALLOWED_CHAIN_IDS
);
