/* eslint-disable no-console */
import fs from "fs"
import path from "path"

import yaml from "js-yaml"

console.log("Updating subgraph-local.yaml")

const devDeployments = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../protocol/deployments/all_dev.json")).toString()
)

const localhostContracts = devDeployments["31337"].localhost.contracts
const deployedSeniorPoolAddress = localhostContracts.SeniorPool.address
const deployedGoldfinchFactoryAddress = localhostContracts.GoldfinchFactory.address
const deployedPoolTokensAddress = localhostContracts.PoolTokens.address
const deployedGoldfinchConfigAddress = localhostContracts.GoldfinchConfig.address
const deployedGfiAddress = localhostContracts.GFI.address
const deployedStakingRewardsAddress = localhostContracts.StakingRewards.address
const deployedBackerRewardsAddress = localhostContracts.BackerRewards.address
const deployedUniqueIdentityAddress = localhostContracts.UniqueIdentity.address
const deployedCommunityRewardsAddress = localhostContracts.CommunityRewards.address
const deployedMerkleDistributorAddress = localhostContracts.MerkleDistributor.address
const deployedBackerMerkleDistributorAddress = localhostContracts.BackerMerkleDistributor.address

const subgraphManifest: any = yaml.load(fs.readFileSync(path.resolve(".", "subgraph.yaml")).toString())

for (let dataSource of subgraphManifest.dataSources) {
  dataSource.network = "localhost"
  delete dataSource.source.startBlock
  switch (dataSource.name) {
    case "SeniorPool":
      dataSource.source.address = deployedSeniorPoolAddress
      break
    case "GoldfinchFactory":
      dataSource.source.address = deployedGoldfinchFactoryAddress
      break
    case "PoolTokens":
      dataSource.source.address = deployedPoolTokensAddress
      break
    case "GFI":
      dataSource.source.address = deployedGfiAddress
      break
    case "StakingRewards":
      dataSource.source.address = deployedStakingRewardsAddress
      break
    case "BackerRewards":
      dataSource.source.address = deployedBackerRewardsAddress
      break
    case "UniqueIdentity":
      dataSource.source.address = deployedUniqueIdentityAddress
      break
    case "GoldfinchConfig":
      dataSource.source.address = deployedGoldfinchConfigAddress
      break
    case "CommunityRewards":
      dataSource.source.address = deployedCommunityRewardsAddress
      break
    case "MerkleDistributor":
      dataSource.source.address = deployedMerkleDistributorAddress
      break
    case "BackerMerkleDistributor":
      dataSource.source.address = deployedBackerMerkleDistributorAddress
      break
    default:
      break
  }
}

for (let dataSource of subgraphManifest.templates) {
  dataSource.network = "localhost"
}

const codeSnippet = `// It's OK if this file shows diffs. The only reason it's committed is to prevent "module not found" errors. Unfortunately it doesn't seem The Graph allows env vars for this kind of thing.
export const LOCALHOST_SENIOR_POOL_ADDRESS = "${deployedSeniorPoolAddress}"
export const LOCALHOST_GOLDFINCH_CONFIG_ADDRESS = "${deployedGoldfinchConfigAddress}"
`

fs.writeFileSync(path.resolve(__dirname, "../subgraph-local.yaml"), yaml.dump(subgraphManifest, {lineWidth: -1}))
fs.writeFileSync(path.resolve(__dirname, "../src/localhost-addresses.ts"), codeSnippet)

console.log("Finished updating subgraph-local.yaml")
