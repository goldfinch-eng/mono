import { ethers } from "ethers";

import { DESIRED_CHAIN_ID } from "@/constants";

import { RPC_URLS } from "./chains";

// TODO yarn patch this to make the batching invervals longer than 10ms
export const batchProvider = new ethers.providers.JsonRpcBatchProvider(
  RPC_URLS[DESIRED_CHAIN_ID],
  DESIRED_CHAIN_ID
);
