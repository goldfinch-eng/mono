import {MAINNET_CHAIN_ID, ChainId, CHAIN_NAME_BY_ID} from "./"

type ContractInfo = {
  address: string
  abi: {}[]
}

export function getCurrentlyDeployedContracts(chainId: ChainId = MAINNET_CHAIN_ID): {[key: string]: ContractInfo} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deploymentsFile = require("../../deployments/all.json")
  const chainName = CHAIN_NAME_BY_ID[chainId]
  return deploymentsFile[chainId].find((item: {name: string}) => item.name === chainName).contracts
}

export async function getAllExistingContracts(chainId: ChainId = MAINNET_CHAIN_ID): Promise<{[key: string]: any}> {
  const contracts = getCurrentlyDeployedContracts(chainId)
  const result = {}
  await Promise.all(
    Object.entries(contracts).map(async ([contractName, contractInfo]) => {
      if (contractName.includes("Proxy") || contractName.includes("Implementation")) {
        return null
      }
      if (contractName === "CreditLineFactory") {
        contractName = "GoldfinchFactory"
      }
      return (result[contractName] = await artifacts.require(contractName as any).at(contractInfo.address))
    })
  )
  return result
}
