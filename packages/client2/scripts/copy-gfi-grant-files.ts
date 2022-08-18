/* eslint-disable no-console */
import fs from "fs";
import path from "path";

console.log(
  "Copying dev GFI grant files from `protocol` to `pages/api/gfi-grants`..."
);

const sourceDir = "../protocol/blockchain_scripts/merkle";
const destDir = "./pages/api/gfi-grants";

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

console.log("Done copying GFI grant files");
