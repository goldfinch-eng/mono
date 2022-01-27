import fs from "fs"
import {toEthers} from "@goldfinch-eng/protocol/test/testHelpers"
import {CommunityRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {CommunityRewardsInstance, BackerMerkleDistributorInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {Deployed} from "../baseDeploy"
import {ContractDeployer, DISTRIBUTOR_ROLE, getProtocolOwner, getTruffleContract} from "../deployHelpers"
import {isMerkleDistributorInfo} from "../merkle/merkleDistributor/types"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

async function getMerkleDistributorRoot(path?: string): Promise<string | undefined> {
  if (!path) {
    logger("Backer merkle distributor info path is undefined.")
    return
  }
  const json = JSON.parse(fs.readFileSync(path, {encoding: "utf8"}))
  if (!isMerkleDistributorInfo(json)) {
    logger("Backer merkle distributor info json failed type guard.")
    return
  }
  return json.merkleRoot
}

async function grantDistributorRoleToBackerMerkleDistributor(
  communityRewards: Deployed<CommunityRewardsInstance>,
  backerMerkleDistributor: Deployed<BackerMerkleDistributorInstance>,
  deployEffects: DeployEffects
): Promise<void> {
  const hasDistributorRole = await communityRewards.contract.hasRole(
    DISTRIBUTOR_ROLE,
    backerMerkleDistributor.contract.address
  )
  if (hasDistributorRole) {
    throw new Error(`${backerMerkleDistributor.name} already has DISTRIBUTOR_ROLE on ${communityRewards.name}.`)
  }
  const protocolOwner = await getProtocolOwner()
  const communityRewardsEthers = (await toEthers<CommunityRewards>(communityRewards.contract)).connect(protocolOwner)
  await deployEffects.add({
    deferred: [
      await communityRewardsEthers.populateTransaction.grantRole(
        DISTRIBUTOR_ROLE,
        backerMerkleDistributor.contract.address
      ),
    ],
  })
}

export async function deployBackerMerkleDistributor(
  deployer: ContractDeployer,
  {
    communityRewards,
    deployEffects,
    backerMerkleDistributorInfoPath = process.env.BACKER_MERKLE_DISTRIBUTOR_INFO_PATH,
  }: {
    communityRewards: Deployed<CommunityRewardsInstance>
    deployEffects: DeployEffects
    backerMerkleDistributorInfoPath?: string
  }
): Promise<Deployed<BackerMerkleDistributorInstance> | undefined> {
  const contractName = "BackerMerkleDistributor"

  const merkleRoot = await getMerkleDistributorRoot(backerMerkleDistributorInfoPath)
  if (!merkleRoot) {
    logger(`Merkle root is undefined. Skipping deploy of ${contractName}`)
    return
  }

  logger(`About to deploy ${contractName}...`)
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const backerMerkleDistributor = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    args: [communityRewards.contract.address, merkleRoot],
  })
  const contract = await getTruffleContract<BackerMerkleDistributorInstance>(contractName, {
    at: backerMerkleDistributor.address,
  })

  const deployed: Deployed<BackerMerkleDistributorInstance> = {
    name: contractName,
    contract,
  }

  await grantDistributorRoleToBackerMerkleDistributor(communityRewards, deployed, deployEffects)

  return deployed
}
