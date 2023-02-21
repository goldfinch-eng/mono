/* eslint-disable no-console */
import fs from "fs"
import path from "path"

import yaml from "js-yaml"

import devDeployments from "../../protocol/deployments/all_dev.json"
type ContractName = keyof typeof devDeployments["31337"][0]["contracts"]

console.log("Updating subgraph-local.yaml")

const localhostContracts = devDeployments["31337"][0].contracts

const subgraphManifest: any = yaml.load(fs.readFileSync(path.resolve(".", "subgraph.yaml")).toString())

for (const dataSource of subgraphManifest.dataSources) {
  dataSource.network = "localhost"
  delete dataSource.source.startBlock
  if (dataSource.name === "CurveFiduUSDC") {
    dataSource.source.address = "0x0000000000000000000000000000000000000000"
  } else if (dataSource.name === "LegacyGoldfinchConfig") {
    dataSource.source.address = localhostContracts["GoldfinchConfig"].address
  } else if (dataSource.name === "Pool") {
    dataSource.source.address = "0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75"
  } else if (dataSource.name === "CreditDesk") {
    dataSource.source.address = "0xD52dc1615c843c30F2e4668E101c0938e6007220"
  } else {
    dataSource.source.address = localhostContracts[dataSource.name as ContractName].address
  }
}

for (const dataSource of subgraphManifest.templates) {
  dataSource.network = "localhost"
}

fs.writeFileSync(path.resolve(__dirname, "../subgraph-local.yaml"), yaml.dump(subgraphManifest, {lineWidth: -1}))

console.log("Finished updating subgraph-local.yaml")
