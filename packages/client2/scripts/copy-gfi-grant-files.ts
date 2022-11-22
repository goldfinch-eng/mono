/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { exit } from "process";

const nextEnv = require("@next/env");
const env = nextEnv.loadEnvConfig(".");
const networkName = env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME as string;

if (networkName === "mainnet") {
  // If we're on mainnet, we don't need dev grants to run
  exit();
}

console.log(
  "Copying dev GFI grant files from `protocol` to `pages/api/gfi-grants`..."
);

const sourceDir = "../protocol/blockchain_scripts/merkle";
const destDir = "./gfi-grants";

try {
  fs.copyFileSync(
    path.resolve(
      sourceDir,
      "backerMerkleDirectDistributor/merkleDirectDistributorInfo.dev.json"
    ),
    path.resolve(destDir, "backerMerkleDirectDistributorInfo.dev.json")
  );
  fs.copyFileSync(
    path.resolve(
      sourceDir,
      "backerMerkleDistributor/merkleDistributorInfo.dev.json"
    ),
    path.resolve(destDir, "backerMerkleDistributorInfo.dev.json")
  );
  fs.copyFileSync(
    path.resolve(
      sourceDir,
      "merkleDirectDistributor/merkleDirectDistributorInfo.dev.json"
    ),
    path.resolve(destDir, "merkleDirectDistributorInfo.dev.json")
  );
  fs.copyFileSync(
    path.resolve(sourceDir, "merkleDistributor/merkleDistributorInfo.dev.json"),
    path.resolve(destDir, "merkleDistributorInfo.dev.json")
  );
} catch (e) {
  console.error(
    "Failed to copy GFI grant files. You probably need to generate them! The easiest way is to run `npm run start:local` from the workspace root."
  );
  console.error(e);
  exit(1);
}

console.log("Done copying GFI grant files");
