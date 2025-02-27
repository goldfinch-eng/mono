import {Go, GoldfinchConfig, TestUniqueIdentity, UniqueIdentity} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"

import {Deployed} from "../baseDeploy"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, getEthersContract, getAccounts} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function deployGo(
  deployer: ContractDeployer,
  {
    configAddress,
    uniqueIdentity,
    deployEffects,
  }: {
    configAddress: string
    uniqueIdentity: Deployed<UniqueIdentity | TestUniqueIdentity>
    deployEffects: DeployEffects
  }
): Promise<Deployed<Go>> {
  const contractName = "Go"
  console.log(`About to deploy ${contractName}...`)

  const {gf_deployer} = await getAccounts()
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
  const contract = await getEthersContract<Go>(contractName, {
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
