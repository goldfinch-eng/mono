import {GoldfinchConfig, GoldfinchPrime} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"

import {Deployed} from "../baseDeploy"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, getEthersContract, getAccounts, getWarblerAddress} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function deployGPrime(
  deployer: ContractDeployer,
  {
    configAddress,
    deployEffects,
  }: {
    configAddress: string
    deployEffects: DeployEffects
  }
): Promise<Deployed<GoldfinchPrime>> {
  const contractName = "GoldfinchPrime"
  console.log(`About to deploy ${contractName}...`)

  const {gf_deployer} = await getAccounts()
  const warblerLabsAddress = await getWarblerAddress()
  const protocol_owner = await getProtocolOwner()

  const gPrime = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "initialize",
          args: [warblerLabsAddress, configAddress, protocol_owner],
        },
      },
    },
  })

  const contract = await getEthersContract<GoldfinchPrime>(contractName, {
    at: gPrime.address,
  })

  const goldfinchConfig = (await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {at: configAddress})).connect(
    await getProtocolOwner()
  )

  await deployEffects.add({
    deferred: [await goldfinchConfig.populateTransaction.setAddress(CONFIG_KEYS.GPrime, contract.address)],
  })

  return {
    name: contractName,
    contract,
  }
}
