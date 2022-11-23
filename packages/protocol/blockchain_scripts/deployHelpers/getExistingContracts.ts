import {ethers} from "hardhat"
import {Signer} from "ethers"
import {MAINNET_CHAIN_ID, getSignerForAddress, ChainId} from "./"
import type {ContractHolder} from "./upgradeContracts"
import {getCurrentlyDeployedContracts} from "./getAllExistingContracts"
import {getProxyImplAddress} from "../helpers/getProxyImplAddress"

export type ExistingContracts = {
  [contractName: string]: Omit<ContractHolder, "UpgradedContract" | "UpgradedImplAddress">
}

export async function getExistingContracts(
  contractNames: string[],
  signer: string | Signer,
  chainId: ChainId = MAINNET_CHAIN_ID
): Promise<ExistingContracts> {
  const contracts: ExistingContracts = {}
  const onChainConfig = getCurrentlyDeployedContracts(chainId)
  for (const contractName of contractNames) {
    const unqualifiedContractName = contractName.split(":")[1] || contractName
    const contractConfig = onChainConfig[unqualifiedContractName] as any
    const proxyConfig = onChainConfig[`${unqualifiedContractName}_Proxy`] as any

    const ethersSigner = await getSignerForAddress(signer)
    const contractProxy =
      proxyConfig && (await ethers.getContractAt(proxyConfig.abi, proxyConfig.address, ethersSigner))
    const contract = await ethers.getContractAt(contractConfig.abi, contractConfig.address, ethersSigner)
    contracts[contractName] = {
      ProxyContract: contractProxy,
      ExistingContract: contract,
      ExistingImplAddress: (await getProxyImplAddress(contractProxy)) as string,
    }
  }
  return contracts
}
