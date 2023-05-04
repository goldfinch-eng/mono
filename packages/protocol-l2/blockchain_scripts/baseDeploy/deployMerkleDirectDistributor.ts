import {GFIInstance, MerkleDirectDistributorInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import fs from "fs"
import {Deployed} from "../baseDeploy"
import {ContractDeployer, getProtocolOwner, getTruffleContract} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"
import {isMerkleDirectDistributorInfo} from "../merkle/merkleDirectDistributor/types"

const logger = console.log

async function getMerkleDirectDistributorRoot(path?: string): Promise<string | undefined> {
  if (!path) {
    logger("MerkleDirectDistributor info path is undefined.")
    return
  }
  const json = JSON.parse(fs.readFileSync(path, {encoding: "utf8"}))
  if (!isMerkleDirectDistributorInfo(json)) {
    logger("MerkleDirectDistributor info json failed type guard.")
    return
  }
  return json.merkleRoot
}

export async function deployMerkleDirectDistributor(
  deployer: ContractDeployer,
  {
    gfi,
    deployEffects,
    merkleDirectDistributorInfoPath = process.env.MERKLE_DIRECT_DISTRIBUTOR_INFO_PATH,
    contractName = "MerkleDirectDistributor",
  }: {
    gfi: Deployed<GFIInstance>
    deployEffects: DeployEffects
    merkleDirectDistributorInfoPath?: string
    contractName?: string
  }
): Promise<Deployed<MerkleDirectDistributorInstance> | undefined> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const merkleRoot = await getMerkleDirectDistributorRoot(merkleDirectDistributorInfoPath)
  if (!merkleRoot) {
    logger(`Merkle root is undefined. Skipping deploy of ${contractName}`)
    return
  }

  logger(`About to deploy ${contractName}...`)
  assertIsString(gf_deployer)
  const merkleDirectDistributor = await deployer.deploy(contractName, {
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
  const contract = await getTruffleContract<MerkleDirectDistributorInstance>(contractName, {
    at: merkleDirectDistributor.address,
  })

  const deployed: Deployed<MerkleDirectDistributorInstance> = {
    name: contractName,
    contract,
  }

  return deployed
}
