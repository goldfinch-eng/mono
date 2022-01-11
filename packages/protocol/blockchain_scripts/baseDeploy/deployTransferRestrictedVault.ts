import {TransferRestrictedVault} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner, assertIsChainId} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployTransferRestrictedVault(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<TransferRestrictedVault> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)

  const contractName = "TransferRestrictedVault"

  logger(`About to deploy ${contractName}...`)
  return await deployer.deploy<TransferRestrictedVault>(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, config.address],
        },
      },
    },
  })
}
