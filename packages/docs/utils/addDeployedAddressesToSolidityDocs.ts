import fs from "fs"
import path from "path"
import { assertNonNullable } from "@goldfinch-eng/utils";

/**
 * Script that adds to each of our contract docs a link to the Etherscan page of the
 * deployment of the contract on mainnet.
 */

import ALL_DEPLOYMENTS from "../../protocol/deployments/all.json";
import POOLS_METADATA from "../../pools/metadata/mainnet.json";

const FILE_OPTIONS: {encoding: BufferEncoding} = {encoding: "utf8"}
const IGNORED_CONTRACTS = ["index"]

const DEPLOYMENT_PREFIX = "**Deployment on Ethereum mainnet: **"
const TRANCHED_POOLS_PREFIX = "**Borrower Pool deployments on Ethereum mainnet: **"

// Generator function for iterating recursively through all files under a directory
function *allFiles(dir: string): Iterable<string> {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      yield* allFiles(path.join(dir, file.name));
    } else {
      yield path.join(dir, file.name);
    }
  }
}

// All mainnet deployed contracts by name
const CONTRACTS: Record<string, { address: string }> = (() => {
  assertNonNullable(ALL_DEPLOYMENTS, "Missing all.json")

  const MAINNET = (ALL_DEPLOYMENTS["1"] || []).find(item => item.name === "mainnet")
  assertNonNullable(MAINNET, "No mainnet deploy found in all.json")
  assertNonNullable(MAINNET.contracts, "No contracts found in all.json")
  assertNonNullable(Object.keys(MAINNET.contracts)[0], "No contracts found in all.json")

  return Object.entries(MAINNET.contracts).reduce((cur, [name, contract]) => ({...cur, [name]: contract}), {})
})(); 

// List of tranched pool etherscan links
const TRANCHED_POOLS_LINKS: string[] = (() => {
  assertNonNullable(POOLS_METADATA, "Missing pools metadata")

  const tranchedPoolAddresses = Object.keys(POOLS_METADATA)
  const tranchedPoolsInfo = tranchedPoolAddresses.map((address: string) => {
    const info = POOLS_METADATA[address]
    assertNonNullable(info)
    return {...info, address}
  }).sort(
    (a, b) => b.launchTime - a.launchTime // reverse-chronological order
  )

  return tranchedPoolsInfo.map((info) => `- [${info.name}](https://etherscan.io/address/${info.address})`)
})() 

// For every contract with a doc file:
// - if it's deployed add the deployed address
// - if it's tranchedpool add all the pool links
for (const fileName of allFiles("./docs/reference/contracts/")) {
  if (!fileName.endsWith(".md")) continue;

  const contractFile = fileName.split('/').pop()
  assertNonNullable(contractFile, `No contract file from: ${fileName}`)

  const contractName = contractFile.split('.md')[0]
  assertNonNullable(contractName, `Failed to identify contract name from filename: ${fileName}`)

  if (IGNORED_CONTRACTS.includes(contractName)) continue;

  const contract = CONTRACTS[contractName]
  if (!contract) continue; // Not all contracts are deployed and have addresses

  const content = fs.readFileSync(fileName, FILE_OPTIONS).split(/[\n\r]/)
  const headingIndex = content.findIndex((line: string) => line.startsWith(`## ${contractName}`))
  if (headingIndex === -1) throw new Error("Failed to identify insertion point.")
  
  content.splice(headingIndex + 2, 0, DEPLOYMENT_PREFIX, "", `https://etherscan.io/address/${contract.address}`, "")

  if (contractName === "TranchedPool") {
    content.splice(headingIndex + 6, 0, TRANCHED_POOLS_PREFIX, "", ...TRANCHED_POOLS_LINKS, "")
  }
  
  fs.writeFileSync(fileName, content.join("\n"), FILE_OPTIONS)
}