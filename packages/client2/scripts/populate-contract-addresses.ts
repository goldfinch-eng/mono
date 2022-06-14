/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
import fs from "fs";
import path from "path";

const nextEnv = require("@next/env");
const prettier = require("prettier");

const env = nextEnv.loadEnvConfig(".");

console.log("Gathering local and mainnet contract addresses...");
const localDeployments = JSON.parse(
  fs
    .readFileSync(
      path.resolve(__dirname, "../../protocol/deployments/all_dev.json")
    )
    .toString()
);
const localContracts = localDeployments["31337"].localhost.contracts;
const mainnetDeployments = JSON.parse(
  fs
    .readFileSync(
      path.resolve(__dirname, "../../protocol/deployments/all.json")
    )
    .toString()
);
const mainnetContracts = mainnetDeployments["1"].mainnet.contracts;

const desiredChainId = env.combinedEnv.NEXT_PUBLIC_DESIRED_CHAIN_ID as string;
const contractAddressFileRelativePath =
  "../constants/contract-addresses/index.ts";
const contracts =
  desiredChainId === "1"
    ? mainnetContracts
    : desiredChainId === "31337"
    ? localContracts
    : null;
if (contracts === null) {
  throw new Error(`Invalid desired chain id: ${desiredChainId}.`);
}
const addresses = {
  USDC:
    contracts.TestERC20?.address ??
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // mainnet doesn't have TestERC20 (obviously), use the actual USDC mainnet address instead
  SeniorPool: contracts.SeniorPool.address,
  GFI: contracts.GFI.address,
  Fidu: contracts.Fidu.address,
  UniqueIdentity: contracts.UniqueIdentity.address,
  Go: contracts.Go.address,
  StakingRewards: contracts.StakingRewards.address,
  Zapper: contracts.Zapper.address,
};
const code = `export const CONTRACT_ADDRESSES = {${desiredChainId}: ${JSON.stringify(
  addresses
)}}`;
fs.writeFileSync(
  path.resolve(__dirname, contractAddressFileRelativePath),
  prettier.format(code, { parser: "typescript" })
);

console.log("Finished gathering local and mainnet contract addresses");
