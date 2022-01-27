import {GFIInstance, BackerMerkleDirectDistributorInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import fs from "fs"
import {Deployed} from "../baseDeploy"
import {ContractDeployer, getProtocolOwner, getTruffleContract} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"
import {isMerkleDirectDistributorInfo} from "../merkle/merkleDirectDistributor/types"

const logger = console.log

async function getMerkleDirectDistributorRoot(path?: string): Promise<string | undefined> {
  if (!path) {
    logger("BackerMerkleDirectDistributor info path is undefined.")
    return
  }
  const json = JSON.parse(fs.readFileSync(path, {encoding: "utf8"}))
  if (!isMerkleDirectDistributorInfo(json)) {
    logger("BackerMerkleDirectDistributor info json failed type guard.")
    return
  }
  return json.merkleRoot
}

export async function deployBackerMerkleDirectDistributor(
  deployer: ContractDeployer,
  {
    gfi,
    deployEffects,
    backerMerkleDirectDistributorInfoPath = process.env.BACKER_MERKLE_DIRECT_DISTRIBUTOR_INFO_PATH,
  }: {
    gfi: Deployed<GFIInstance>
    deployEffects: DeployEffects
    backerMerkleDirectDistributorInfoPath?: string
  }
): Promise<Deployed<BackerMerkleDirectDistributorInstance> | undefined> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "BackerMerkleDirectDistributor"

  const merkleRoot = await getMerkleDirectDistributorRoot(backerMerkleDirectDistributorInfoPath)
  if (!merkleRoot) {
    logger(`Merkle root is undefined. Skipping deploy of ${contractName}`)
    return
  }

  logger(`About to deploy ${contractName}...`)
  assertIsString(gf_deployer)
  const backerMerkleDirectDistributor = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, gfi.contract.address, merkleRoot],
        },
      },
    },
  })
  const contract = await getTruffleContract<BackerMerkleDirectDistributorInstance>(contractName, {
    at: backerMerkleDirectDistributor.address,
  })

  const deployed: Deployed<BackerMerkleDirectDistributorInstance> = {
    name: contractName,
    contract,
  }

  return deployed
}
