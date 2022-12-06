import {WithdrawalRequestToken} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

const CONTRACT_NAME = "WithdrawalRequestToken"

export async function deployWithdrawalRequestToken(deployer: ContractDeployer, {config, deployEffects}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocolOwner = await getProtocolOwner()
  assertIsString(gf_deployer)
  assertIsString(protocolOwner)

  const withdrawalRequestToken = await deployer.deploy<WithdrawalRequestToken>(CONTRACT_NAME, {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocolOwner, config.address],
        },
      },
    },
  })

  if (deployEffects !== undefined) {
    await deployEffects.add({
      deferred: [
        await config.populateTransaction.setAddress(CONFIG_KEYS.WithdrawalRequestToken, withdrawalRequestToken.address),
      ],
    })
  } else {
    await updateConfig(config, "address", CONFIG_KEYS.WithdrawalRequestToken, withdrawalRequestToken.address, {logger})
  }

  return withdrawalRequestToken
}
