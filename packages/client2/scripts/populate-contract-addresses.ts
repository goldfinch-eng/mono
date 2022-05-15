/* eslint-disable no-console */
import fs from "fs";
import path from "path";

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

[
  {
    relativePath: "../constants/contract-addresses/localhost.json",
    contracts: localContracts,
  },
  {
    relativePath: "../constants/contract-addresses/mainnet.json",
    contracts: mainnetContracts,
  },
].forEach(({ relativePath, contracts }) => {
  const addresses = {
    USDC:
      contracts.TestERC20?.address ??
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // mainnet doesn't have TestERC20 (obviously), use the actual USDC mainnet address instead
    SeniorPool: contracts.SeniorPool.address,
    GFI: contracts.GFI.address,
    UniqueIdentity: contracts.UniqueIdentity.address,
  };
  const pathname = path.resolve(__dirname, relativePath);
  fs.writeFileSync(pathname, JSON.stringify(addresses, null, 2));
});

console.log("Finished gathering local and mainnet contract addresses");
