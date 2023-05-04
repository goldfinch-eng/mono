import fs from "fs"
import {toEthers} from "@goldfinch-eng/protocol/test/testHelpers"
import {CommunityRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {CommunityRewardsInstance, MerkleDistributorInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {Deployed} from "../baseDeploy"
import {ContractDeployer, DISTRIBUTOR_ROLE, getProtocolOwner, getTruffleContract} from "../deployHelpers"
import {isMerkleDistributorInfo} from "../merkle/merkleDistributor/types"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

async function getMerkleDistributorRoot(path?: string): Promise<string | undefined> {
  if (!path) {
    logger("Merkle distributor info path is undefined.")
    return
  }
  const json = JSON.parse(fs.readFileSync(path, {encoding: "utf8"}))
  if (!isMerkleDistributorInfo(json)) {
    logger("Merkle distributor info json failed type guard.")
    return
  }
  return json.merkleRoot
}

async function grantDistributorRoleToMerkleDistributor(
  communityRewards: Deployed<CommunityRewardsInstance>,
  merkleDistributor: Deployed<MerkleDistributorInstance>,
  deployEffects: DeployEffects
): Promise<void> {
  const hasDistributorRole = await communityRewards.contract.hasRole(
    DISTRIBUTOR_ROLE,
    merkleDistributor.contract.address
  )
  if (hasDistributorRole) {
    throw new Error(`${merkleDistributor.name} already has DISTRIBUTOR_ROLE on ${communityRewards.name}.`)
  }
  const protocolOwner = await getProtocolOwner()
  const communityRewardsEthers = (await toEthers<CommunityRewards>(communityRewards.contract)).connect(protocolOwner)
  await deployEffects.add({
    deferred: [
      await communityRewardsEthers.populateTransaction.grantRole(DISTRIBUTOR_ROLE, merkleDistributor.contract.address),
    ],
  })
}

export async function deployMerkleDistributor(
  deployer: ContractDeployer,
  {
    communityRewards,
    deployEffects,
    merkleDistributorInfoPath = process.env.MERKLE_DISTRIBUTOR_INFO_PATH,
    contractName = "MerkleDistributor",
  }: {
    communityRewards: Deployed<CommunityRewardsInstance>
    deployEffects: DeployEffects
    merkleDistributorInfoPath?: string
    contractName?: string
  }
): Promise<Deployed<MerkleDistributorInstance> | undefined> {
  const merkleRoot = await getMerkleDistributorRoot(merkleDistributorInfoPath)
  if (!merkleRoot) {
    logger(`Merkle root is undefined. Skipping deploy of ${contractName}`)
    return
  }

  logger(`About to deploy ${contractName}...`)
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const merkleDistributor = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    args: [communityRewards.contract.address, merkleRoot],
  })
  const contract = await getTruffleContract<MerkleDistributorInstance>(contractName, {at: merkleDistributor.address})

  const deployed: Deployed<MerkleDistributorInstance> = {
    name: contractName,
    contract,
  }

  await grantDistributorRoleToMerkleDistributor(communityRewards, deployed, deployEffects)

  return deployed
}
