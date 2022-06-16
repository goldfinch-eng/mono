import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {UniqueIdentityInstance, TestUniqueIdentityInstance, GoInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {Deployed} from "../baseDeploy"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, getEthersContract, getTruffleContract} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

export async function deployGo(
  deployer: ContractDeployer,
  {
    configAddress,
    uniqueIdentity,
    deployEffects,
  }: {
    configAddress: string
    uniqueIdentity: Deployed<UniqueIdentityInstance | TestUniqueIdentityInstance>
    deployEffects: DeployEffects
  }
): Promise<Deployed<GoInstance>> {
  const contractName = "Go"
  logger(`About to deploy ${contractName}...`)
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const protocol_owner = await getProtocolOwner()
  const go = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, configAddress, uniqueIdentity.contract.address],
        },
      },
    },
  })
  const contract = await getTruffleContract<GoInstance>(contractName, {
    at: go.address,
  })

  const goldfinchConfig = (await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {at: configAddress})).connect(
    await getProtocolOwner()
  )

  await deployEffects.add({
    deferred: [await goldfinchConfig.populateTransaction.setAddress(CONFIG_KEYS.Go, contract.address)],
  })

  return {
    name: contractName,
    contract,
  }
}
