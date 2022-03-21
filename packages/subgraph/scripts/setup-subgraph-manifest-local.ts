/* eslint-disable no-console */
import fs from "fs"
import path from "path"

import yaml from "js-yaml"

console.log("Updating subgraph-local.yaml")

const devDeployments = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../protocol/deployments/all_dev.json")).toString()
)

const deployedSeniorPoolProxyAddress = devDeployments["31337"].localhost.contracts.SeniorPool_Proxy.address
const deployedGoldfinchFactoryProxyAddress = devDeployments["31337"].localhost.contracts.GoldfinchFactory_Proxy.address
const deployedPoolProxyAddress = devDeployments["31337"].localhost.contracts.Pool_Proxy.address
const deployedPoolTokensProxyAddress = devDeployments["31337"].localhost.contracts.PoolTokens_Proxy.address
const deployedGoldfinchConfigAddress = devDeployments["31337"].localhost.contracts.GoldfinchConfig.address
const deployedFiduAddress = devDeployments["31337"].localhost.contracts.Fidu.address
const deployedStakingRewardsProxyAddress = devDeployments["31337"].localhost.contracts.StakingRewards_Proxy.address

const subgraphManifest: any = yaml.load(fs.readFileSync(path.resolve(".", "subgraph.yaml")).toString())

for (let dataSource of subgraphManifest.dataSources) {
  dataSource.network = "localhost"
  delete dataSource.source.startBlock
  switch (dataSource.name) {
    case "SeniorPoolProxy":
      dataSource.source.address = deployedSeniorPoolProxyAddress
      break
    case "GoldfinchFactoryProxy":
      dataSource.source.address = deployedGoldfinchFactoryProxyAddress
      break
    case "PoolProxy":
      dataSource.source.address = deployedPoolProxyAddress
      break
    case "PoolTokensProxy":
      dataSource.source.address = deployedPoolTokensProxyAddress
      break
    case "StakingRewardsProxy":
      dataSource.source.address = deployedStakingRewardsProxyAddress
      break
    default:
      break
  }
}

for (let dataSource of subgraphManifest.templates) {
  dataSource.network = "localhost"
}

const codeSnippet = `// It's OK if this file shows diffs. The only reason it's committed is to prevent "module not found" errors. Unfortunately it doesn't seem The Graph allows env vars for this kind of thing.
export const LOCALHOST_FIDU_ADDRESS = "${deployedFiduAddress}"
export const LOCALHOST_SENIOR_POOL_ADDRESS = "${deployedSeniorPoolProxyAddress}"
export const LOCALHOST_POOL_TOKENS_ADDRESS = "${deployedPoolTokensProxyAddress}"
export const LOCALHOST_GOLDFINCH_CONFIG_ADDRESS = "${deployedGoldfinchConfigAddress}"
`

fs.writeFileSync(path.resolve(__dirname, "../subgraph-local.yaml"), yaml.dump(subgraphManifest, {lineWidth: -1}))
fs.writeFileSync(path.resolve(__dirname, "../src/localhost-addresses.ts"), codeSnippet)

console.log("Finished updating subgraph-local.yaml")
