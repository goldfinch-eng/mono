import path from "path"
import fs from "fs"

function main() {
  const input = path.join(__dirname, "../../protocol/deployments/all_dev.json")
  const inputJson = JSON.parse(fs.readFileSync(input, {encoding: "utf8"}))
  const deployedSeniorPoolProxyAddress = inputJson["31337"].localhost.contracts.SeniorPool_Proxy.address
  const deployedGoldfinchFactoryProxyAddress = inputJson["31337"].localhost.contracts.GoldfinchFactory_Proxy.address
  const deployedPoolProxyAddress = inputJson["31337"].localhost.contracts.Pool_Proxy.address
  const deployedPoolTokensProxyAddress = inputJson["31337"].localhost.contracts.PoolTokens_Proxy.address
  const deployedGoldfinchConfigAddress = inputJson["31337"].localhost.contracts.GoldfinchConfig.address
  const deployedFiduAddress = inputJson["31337"].localhost.contracts.Fidu.address

  const subgraphConfigPath = path.join(__dirname, "../subgraph.yaml")
  const subgraphConstantsPath = path.join(__dirname, "../src/constants.ts")

  const subgraphConfigFile = fs.readFileSync(subgraphConfigPath, {encoding: "utf8"})
  let configResult = subgraphConfigFile.replace(/0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822/g, deployedSeniorPoolProxyAddress)
  configResult = configResult.replace(/0xd20508E1E971b80EE172c73517905bfFfcBD87f9/g, deployedGoldfinchFactoryProxyAddress)
  configResult = configResult.replace(/0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75/g, deployedPoolProxyAddress)
  configResult = configResult.replace(/0x57686612C601Cb5213b01AA8e80AfEb24BBd01df/g, deployedPoolTokensProxyAddress)
  configResult = configResult.replace(/startBlock.*/g, "");
  fs.writeFileSync(subgraphConfigPath, configResult, {encoding: "utf8"})

  const subgraphConstantsFile = fs.readFileSync(subgraphConstantsPath, {encoding: "utf8"})
  let constantsResult = subgraphConstantsFile.replace(/0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822/g, deployedSeniorPoolProxyAddress)
  constantsResult = constantsResult.replace(/0x6a445E9F40e0b97c92d0b8a3366cEF1d67F700BF/g, deployedFiduAddress)
  constantsResult = constantsResult.replace(/0x57686612C601Cb5213b01AA8e80AfEb24BBd01df/g, deployedPoolTokensProxyAddress)
  constantsResult = constantsResult.replace(/0x4eb844Ff521B4A964011ac8ecd42d500725C95CC/g, deployedGoldfinchConfigAddress)
  fs.writeFileSync(subgraphConstantsPath, constantsResult, {encoding: "utf8"})
}

main()
