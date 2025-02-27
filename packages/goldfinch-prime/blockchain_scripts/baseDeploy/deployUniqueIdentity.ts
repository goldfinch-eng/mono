import {GoldfinchConfig, TestUniqueIdentity, UniqueIdentity} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"

import {Deployed} from "../baseDeploy"
import {
  ContractDeployer,
  getAccounts,
  getProtocolOwner,
  isMainnetForking,
  isTestEnv,
  SIGNER_ROLE,
} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"
import {UNIQUE_IDENTITY_METADATA_URI} from "../uniqueIdentity/constants"

export async function deployUniqueIdentity({
  deployer,
  trustedSigner,
  supportedUIDTypes,
  config,
  deployEffects,
}: {
  deployer: ContractDeployer
  trustedSigner: string
  supportedUIDTypes: number[]
  config: GoldfinchConfig
  deployEffects: DeployEffects
}): Promise<Deployed<UniqueIdentity | TestUniqueIdentity>> {
  const contractName = isTestEnv() && !isMainnetForking() ? "TestUniqueIdentity" : "UniqueIdentity"
  console.log(`About to deploy ${contractName}...`)

  const {gf_deployer} = await getAccounts()
  // Current owner: 0x502DD7Ea171b7803b0F5ED59285D7A0114b8d9Fd
  const protocol_owner = await getProtocolOwner()

  const contract = await deployer.deploy<UniqueIdentity | TestUniqueIdentity>(contractName, {
    from: gf_deployer,
    skipIfAlreadyDeployed: true,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      proxyContract: "EIP173Proxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, config.address, UNIQUE_IDENTITY_METADATA_URI],
        },
      },
    },
  })

  await deployEffects.add({
    deferred: [await contract.populateTransaction.grantRole(SIGNER_ROLE, trustedSigner)],
  })
  await deployEffects.add({
    deferred: [
      await contract.populateTransaction.setSupportedUIDTypes(
        supportedUIDTypes,
        supportedUIDTypes.map(() => true)
      ),
    ],
  })

  return {
    name: contractName,
    contract,
  }
}
