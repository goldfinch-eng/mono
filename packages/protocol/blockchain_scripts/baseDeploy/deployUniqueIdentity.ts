import {toEthers} from "@goldfinch-eng/protocol/test/testHelpers"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {UniqueIdentityInstance, TestUniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {Deployed} from "../baseDeploy"
import {ContractDeployer, getProtocolOwner, getTruffleContract, isTestEnv, SIGNER_ROLE} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"
import {UNIQUE_IDENTITY_METADATA_URI} from "../uniqueIdentity/constants"

const logger = console.log

export async function deployUniqueIdentity({
  deployer,
  trustedSigner,
  deployEffects,
}: {
  deployer: ContractDeployer
  trustedSigner: string
  deployEffects: DeployEffects
}): Promise<Deployed<UniqueIdentityInstance | TestUniqueIdentityInstance>> {
  const contractName = isTestEnv() ? "TestUniqueIdentity" : "UniqueIdentity"
  logger(`About to deploy ${contractName}...`)
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const protocol_owner = await getProtocolOwner()
  const uniqueIdentity = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      proxyContract: "EIP173Proxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, UNIQUE_IDENTITY_METADATA_URI],
        },
      },
    },
  })
  const truffleContract = await getTruffleContract<UniqueIdentityInstance | TestUniqueIdentityInstance>(contractName, {
    at: uniqueIdentity.address,
  })
  const ethersContract = (await toEthers<UniqueIdentity>(truffleContract)).connect(await getProtocolOwner())

  await deployEffects.add({
    deferred: [await ethersContract.populateTransaction.grantRole(SIGNER_ROLE, trustedSigner)],
  })

  return {
    name: contractName,
    contract: truffleContract,
  }
}
