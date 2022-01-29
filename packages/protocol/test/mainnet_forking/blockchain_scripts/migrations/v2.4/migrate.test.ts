import {promises as fs} from "fs"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {
  DISTRIBUTOR_ROLE,
  getProtocolOwner,
  getTruffleContract,
  ZERO_ADDRESS,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate2_4 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.4/migrate"
import {bigVal, expectOwnerRole, expectProxyOwner, expectRoles} from "@goldfinch-eng/protocol/test/testHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {isMerkleDistributorInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {isMerkleDirectDistributorInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import BN from "bn.js"
import {
  BackerMerkleDirectDistributorInstance,
  CommunityRewardsInstance,
  GFIInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const gfi = await getTruffleContract<GFIInstance>("GFI")
  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  const communityRewardsStartingBalance = await communityRewards.rewardsAvailable()

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  const grantAddress1StartingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress1)
  const grantAddress2StartingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress2)

  await migrate2_4.main()

  return {
    gfi,
    communityRewards,
    communityRewardsStartingBalance,
    grantAddress1StartingBalance,
    grantAddress2StartingBalance,
  }
})

describe("v2.4", async function () {
  this.timeout(TEST_TIMEOUT)

  let gfi: GFIInstance
  let communityRewards: CommunityRewardsInstance
  let communityRewardsStartingBalance: BN

  let grantAddress1StartingBalance: BN
  let grantAddress2StartingBalance: BN

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      gfi,
      communityRewards,
      communityRewardsStartingBalance,
      grantAddress1StartingBalance,
      grantAddress2StartingBalance,
    } = await setupTest())
  })

  it("deploys BackerMerkleDirectDistributor", async () => {
    await expect(deployments.get("BackerMerkleDirectDistributor")).to.not.be.rejected
  })

  it("initializes BackerMerkleDirectDistributor", async () => {
    await expect(
      (
        await getTruffleContract<BackerMerkleDirectDistributorInstance>("BackerMerkleDirectDistributor")
      ).initialize(ZERO_ADDRESS, ZERO_ADDRESS, web3.utils.keccak256("test"), {from: await getProtocolOwner()})
    ).to.be.rejectedWith(/initialized/)
  })

  it("deploys BackerMerkleDistributor", async () => {
    await expect(deployments.get("BackerMerkleDistributor")).to.not.be.rejected
  })

  expectProxyOwner({
    toBe: getProtocolOwner,
    forContracts: ["BackerMerkleDirectDistributor"],
  })

  expectOwnerRole({
    toBe: getProtocolOwner,
    forContracts: ["BackerMerkleDirectDistributor"],
  })

  expectRoles([
    {
      contractName: "CommunityRewards",
      roles: [DISTRIBUTOR_ROLE],
      address: async () => (await deployments.get("BackerMerkleDistributor")).address,
    },
  ])

  it("loads GFI into CommunityRewards using merkleDistributorInfo amount", async () => {
    const merkleDistributorInfo = JSON.parse(String(await fs.readFile(migrate2_4.merkleDistributorInfoPath)))
    if (!isMerkleDistributorInfo(merkleDistributorInfo)) {
      throw new Error("Invalid merkle distributor info")
    }
    const merkleDistributorAmount = web3.utils.toBN(merkleDistributorInfo.amountTotal)

    const rewardsAvailable = await communityRewards.rewardsAvailable()

    expect(rewardsAvailable.sub(communityRewardsStartingBalance)).to.bignumber.eq(merkleDistributorAmount)
  })

  it("loads GFI into BackerMerkleDirectDistributor using merkleDirectDistributorInfo amount", async () => {
    const merkleDirectDistributorInfo = JSON.parse(
      String(await fs.readFile(migrate2_4.merkleDirectDistributorInfoPath))
    )
    if (!isMerkleDirectDistributorInfo(merkleDirectDistributorInfo)) {
      throw new Error("Invalid merkle direct distributor info")
    }
    const merkleDirectDistributorAmount = web3.utils.toBN(merkleDirectDistributorInfo.amountTotal)

    const directDistributor = await deployments.get("BackerMerkleDirectDistributor")

    expect(await gfi.balanceOf(directDistributor.address)).to.bignumber.eq(merkleDirectDistributorAmount)
  })

  it("distributes GFI grant to the two community contributors", async () => {
    const grantAddress1EndingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress1)
    const grantAddress2EndingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress2)

    expect(grantAddress1EndingBalance.sub(grantAddress1StartingBalance)).to.bignumber.eq(bigVal(275))
    expect(grantAddress2EndingBalance.sub(grantAddress2StartingBalance)).to.bignumber.eq(bigVal(275))
  })
})
