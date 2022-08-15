/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
import fs from "fs";
import path from "path";

const nextEnv = require("@next/env");
const prettier = require("prettier");

const env = nextEnv.loadEnvConfig(".");
const networkName = env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME as string;
console.log(`Gathering contract addresses for network ${networkName}`);
let contracts: Record<string, { address: string }>;
if (networkName === "mainnet") {
  const mainnetDeployments = JSON.parse(
    fs
      .readFileSync(
        path.resolve(__dirname, "../../protocol/deployments/all.json")
      )
      .toString()
  );
  contracts = mainnetDeployments["1"].mainnet.contracts;
} else if (networkName === "localhost") {
  const localDeployments = JSON.parse(
    fs
      .readFileSync(
        path.resolve(__dirname, "../../protocol/deployments/all_dev.json")
      )
      .toString()
  );
  contracts = localDeployments["31337"].localhost.contracts;
} else if (networkName === "murmuration") {
  const murmurationDeployments = JSON.parse(
    fs
      .readFileSync(
        path.resolve(
          __dirname,
          "../constants/contract-addresses/all_murmuration.json"
        )
      )
      .toString()
  );
  contracts = murmurationDeployments["31337"].localhost.contracts;
} else {
  throw new Error(`Unrecognized network name ${networkName}`);
}

const contractAddressFileRelativePath =
  "../constants/contract-addresses/index.ts";
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
  CommunityRewards: contracts.CommunityRewards.address,
  MerkleDistributor: contracts.MerkleDistributor.address,
  BackerMerkleDistributor: contracts.BackerMerkleDistributor.address,
  MerkleDirectDistributor: contracts.MerkleDirectDistributor.address,
  BackerMerkleDirectDistributor:
    contracts.BackerMerkleDirectDistributor.address,
  BackerRewards: contracts.BackerRewards.address,
};
const code = `// For network: ${networkName}
export const CONTRACT_ADDRESSES = ${JSON.stringify(addresses)};
`;
fs.writeFileSync(
  path.resolve(__dirname, contractAddressFileRelativePath),
  prettier.format(code, { parser: "typescript" })
);

console.log(`Finished gathering contract addresses for network ${networkName}`);
