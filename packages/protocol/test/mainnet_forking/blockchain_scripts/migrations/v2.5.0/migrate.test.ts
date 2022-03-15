import hre, {deployments, getNamedAccounts} from "hardhat"
import {asNonNullable, assertIsString} from "packages/utils/src/type"
import {
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import * as migrate250 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5.0/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  BackerRewardsInstance,
  CommunityRewardsInstance,
  CreditLineInstance,
  ERC20Instance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {
  advanceTime,
  BN,
  createPoolWithCreditLine,
  expectOwnerRole,
  expectProxyOwner,
  getTruffleContractAtAddress,
  mochaEach,
} from "@goldfinch-eng/protocol/test/testHelpers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const go = await getTruffleContract<GoInstance>("Go")
  const gfi = await getTruffleContract<GFIInstance>("GFI")
  const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})
  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  const goldfinchConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig")
  const backerRewards = await getTruffleContract<BackerRewardsInstance>("BackerRewards")
  const seniorPool = await getTruffleContract<SeniorPoolInstance>("SeniorPool")
  const stakingRewards = await getTruffleContract<StakingRewardsInstance>("StakingRewards")
  const uniqueIdentity = await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity")
  const goldfinchFactory = await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory")
  const poolTokens = await getTruffleContract<PoolTokensInstance>("PoolTokens")
  const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {
    gfi,
    usdc,
    goldfinchConfig,
    communityRewards,
    backerRewards,
    seniorPool,
    stakingRewards,
    go,
    uniqueIdentity,
    goldfinchFactory,
    poolTokens,
  }
})

const almaPool6Info = {
  address: "0x418749e294cabce5a714efccc22a8aade6f9db57",
  aPoolToken: {
    // Cf. https://etherscan.io/token/0x57686612c601cb5213b01aa8e80afeb24bbd01df?a=512
    ownerAddress: "0xf21a3d0146b0ceb7cb45ba7543c3ca3525a8830d",
    id: "512",
  },
}

describe("v2.5.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let backerRewards: BackerRewardsInstance
  let go: GoInstance
  let uniqueIdentity: UniqueIdentityInstance
  let goldfinchFactory: GoldfinchFactoryInstance
  let gfi: GFIInstance
  let poolTokens: PoolTokensInstance
  let usdc: ERC20Instance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({backerRewards, go, uniqueIdentity, goldfinchFactory, gfi, poolTokens, usdc} = await setupTest())
  })

  describe("after deploy", async () => {
    let params: migrate250.Migration250Params
    const setupTest = deployments.createFixture(async () => {
      const {params} = await migrate250.main()
      return {params}
    })

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({params} = await setupTest())
    })

    describe("UniqueIdentity", async () => {
      describe("supportedUIDType", async () => {
        mochaEach([0, 1, 2, 3, 4]).it("is true for type = %d", async (type: number) => {
          expect(await uniqueIdentity.supportedUIDTypes(type)).to.equal(true)
        })
      })
    })

    describe("BackerRewards", async () => {
      describe("GFI balance", () => {
        it("should be 0", async () => {
          const gfiBalance = await gfi.balanceOf(backerRewards.address)
          expect(gfiBalance).to.bignumber.equal(new BN(0))
        })
      })

      describe("maxInterestDollarsElligible", async () => {
        it("is correct", async () => {
          expect(await backerRewards.maxInterestDollarsEligible()).to.bignumber.eq(
            params.BackerRewards.maxInterestDollarsEligible
          )
        })
      })

      describe("totalRewardPercentOfTotalGFI", async () => {
        it("is correct", async () => {
          // This function returns percentage points as the base unit. meaning that 1e18 = 1 percent
          const two = "2000000000000000000"
          expect((await backerRewards.totalRewardPercentOfTotalGFI()).toString()).to.eq(two)
        })
      })

      describe("withdraw", () => {
        const tokenInfo = almaPool6Info.aPoolToken

        context("before interest repayment", function () {
          beforeEach(async () => {
            await impersonateAccount(hre, tokenInfo.ownerAddress)
            await fundWithWhales(["ETH"], [tokenInfo.ownerAddress])
            const info = await poolTokens.tokens(tokenInfo.id)
            const principalAmount = info[2]
            expect(principalAmount.gt(new BN(0))).to.be.true
          })

          it('allows "withdrawing" 0', async () => {
            const claimableRewards = await backerRewards.poolTokenClaimableRewards(tokenInfo.id)
            expect(claimableRewards).to.bignumber.equal(new BN(0))
            const withdrawal = backerRewards.withdraw(tokenInfo.id, {
              from: tokenInfo.ownerAddress,
            })
            await expect(withdrawal).to.be.fulfilled
          })
        })
        context("after interest repayment", function () {
          beforeEach(async () => {
            await impersonateAccount(hre, tokenInfo.ownerAddress)
            await fundWithWhales(["ETH"], [tokenInfo.ownerAddress])

            const owner = await getProtocolOwner()
            await fundWithWhales(["USDC"], [owner])

            await advanceTime({days: "30"})

            const tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>(
              "TranchedPool",
              almaPool6Info.address
            )
            await tranchedPool.assess()
            const creditLine = await getTruffleContractAtAddress<CreditLineInstance>(
              "CreditLine",
              await tranchedPool.creditLine()
            )
            const interestOwedBefore = await creditLine.interestOwed()
            expect(interestOwedBefore.gt(new BN(0))).to.be.true

            await usdc.approve(tranchedPool.address, interestOwedBefore, {from: owner})
            await tranchedPool.pay(interestOwedBefore.toString(), {from: owner})

            const interestOwedAfter = await creditLine.interestOwed()
            expect(interestOwedAfter).to.bignumber.equal(new BN(0))
          })

          it("rejects withdrawing non-zero amount, due to insufficient GFI", async () => {
            const claimableRewards = await backerRewards.poolTokenClaimableRewards(tokenInfo.id)
            expect(claimableRewards).to.bignumber.equal(new BN("3014668121250461200"))
            const withdrawal = backerRewards.withdraw(tokenInfo.id, {
              from: tokenInfo.ownerAddress,
            })
            await expect(withdrawal).to.be.rejectedWith(/ERC20: transfer amount exceeds balance/)
          })
        })
      })
    })

    context("CommunityRewards", () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["CommunityRewards"],
      })
    })

    describe("BackerRewards", async () => {
      mochaEach(migrate250.BACKER_REWARDS_PARAMS_POOL_ADDRS).describe("pool at '%s'", (address) => {
        let tranchedPool: TranchedPool
        let creditLine: CreditLine
        let borrowerContract: Borrower
        let borrowerEoa: string
        let backerTokenIds: string[]
        let ethersSeniorPool: SeniorPool
        let ethersStakingRewards: StakingRewards
        const getBackerTokenIds = async (tranchedPool: TranchedPool): Promise<string[]> => {
          const events = await tranchedPool.queryFilter(tranchedPool.filters.DepositMade(undefined, 2))
          return events.map((x) => x.args.tokenId.toString())
        }

        beforeEach(async () => {
          tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: address})
          creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await tranchedPool.creditLine()})
          borrowerContract = await getEthersContract<Borrower>("Borrower", {at: await creditLine.borrower()})
          borrowerEoa = await borrowerContract.getRoleMember(OWNER_ROLE, 0)
          ethersSeniorPool = await getEthersContract<SeniorPool>("SeniorPool")
          ethersStakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
          await impersonateAccount(hre, borrowerEoa)
          await fundWithWhales(["ETH", "USDC"], [borrowerEoa])
          const borrowerSigner = await hre.ethers.provider.getSigner(borrowerEoa)
          tranchedPool = tranchedPool.connect(borrowerSigner)
          borrowerContract = borrowerContract.connect(borrowerSigner)
          backerTokenIds = await getBackerTokenIds(tranchedPool)
          console.log(backerTokenIds)
        })

        describe("before first repayment", async () => {
          it("backers should accrue no staking rewards", async () => {
            const stakingRewardsEarned = await Promise.all(
              backerTokenIds.map(async (tokenId) => backerRewards.stakingRewardsEarnedSinceLastCheckpoint(tokenId))
            )
            expect(stakingRewardsEarned.every((x) => x.toString() === "0"))
          })
        })

        describe("after first repayment", async () => {
          let repaymentBlockNumber: number

          beforeEach(async () => {
            const dueTime = await creditLine.nextDueTime()
            await advanceTime({toSecond: dueTime.toString()})
            await tranchedPool.assess()
            const interestOwed = await creditLine.interestOwed()
            await usdc.approve(borrowerContract.address, interestOwed.toString(), {from: borrowerEoa})
            const tx = await borrowerContract.pay(tranchedPool.address, interestOwed)
            repaymentBlockNumber = tx.blockNumber as number
          })

          const getLatestDrawdownBlockNumber = async (tranchedPool: TranchedPool): Promise<number> => {
            const drawdownEvents = await tranchedPool.queryFilter(tranchedPool.filters.DrawdownMade())

            if (drawdownEvents.length === 0) {
              throw new Error("No DrawdownMade events found!")
            }

            return drawdownEvents[drawdownEvents.length - 1]?.blockNumber as number
          }

          it("backers should earn equivalent staking rewards as LPs", async () => {
            const drawdownBlockNum = await getLatestDrawdownBlockNumber(tranchedPool)
            console.log("NUM", drawdownBlockNum)
            const sharePriceAtDrawdown = await ethersSeniorPool.sharePrice({blockTag: drawdownBlockNum})
            const rewardsAccAtDrawdown = await ethersStakingRewards.accumulatedRewardsPerToken({
              blockTag: drawdownBlockNum,
            })
            const rewardsAccAtRepayment = await ethersStakingRewards.accumulatedRewardsPerToken({
              blockTag: repaymentBlockNumber,
            })
            const rewardsPerTokenSinceDrawdown = rewardsAccAtRepayment.sub(rewardsAccAtDrawdown)

            console.log("XXX", rewardsAccAtDrawdown.toString())
            console.log("YYY", sharePriceAtDrawdown.toString())

            const getExpectedRewards = (amount: BN) => {
              return amount
                .mul(new BN("1000000000000000000"))
                .div(new BN("1000000"))
                .mul(new BN("1000000000000000000"))
                .div(new BN(sharePriceAtDrawdown.toString()))
                .mul(new BN(rewardsPerTokenSinceDrawdown.toString()))
                .div(new BN("1000000000000000000"))
                .mul(new BN("5"))
            }

            const tokenIdsWithPrincipal = await Promise.all(
              backerTokenIds.map(async (tokenId) => {
                return Promise.all([
                  tokenId,
                  poolTokens.getTokenInfo(tokenId).then((i) => i.principalAmount.toString()),
                  poolTokens.getTokenInfo(tokenId).then((i) => i.principalRedeemed.toString()),
                  backerRewards.stakingRewardsEarnedSinceLastCheckpoint(tokenId).then((x) => x.toString()),
                ])
              })
            )

            /*
              TODO(PR): 
                1. get the amount that the backer deposited
                2. get the block number that the principal was withdrawn (latest drawdown event)
                3. get the staking rewardsAcc and sharePrice
                4. get the current stakingRewardsAcc
            */
            for (const [tokenId, principal, pRedeemed, rewardsEarned] of tokenIdsWithPrincipal) {
              console.log("token = ", tokenId)
              const outstandingPrincipal = new BN(principal).sub(new BN(pRedeemed))
              console.log("deposited ", principal)
              console.log("oustanding", outstandingPrincipal.toString())
              console.log("all", principal == outstandingPrincipal.toString())
              const expectedRewards = getExpectedRewards(outstandingPrincipal)
              expect(rewardsEarned).to.bignumber.closeTo(expectedRewards, "100000000000")
            }
          })
        })

        describe("poolStakingRewards", async () => {
          let stakingRewardsPoolInfo
          beforeEach(async () => {
            stakingRewardsPoolInfo = await backerRewards.poolStakingRewards(address)
          })

          it("accumulatedRewardsPerTokenAtLastCheckpoint is correct", async () => {
            expect(stakingRewardsPoolInfo).to.exist
            expect(stakingRewardsPoolInfo.accumulatedRewardsPerTokenAtLastCheckpoint).not.to.bignumber.eq("0")
            expect(stakingRewardsPoolInfo.accumulatedRewardsPerTokenAtLastCheckpoint).to.bignumber.eq(
              new BN(params.BackerRewards.forceInitializeStakingRewardsPoolInfo[address].accumulatedRewardsPerToken)
            )
          })

          // NOTE: for some reason neither ethers nor truffle are returning the expected SliceInfo struct, so we're
          //        skipping these tests
          describe.skip("slicesInfo", () => {
            describe("for slice 0", () => {
              let sliceInfo
              beforeEach(async () => {
                // TODO(PR): how do we get a slice????????
              })

              it("fiduSharePriceAtDrawdown is correct is correct", async () => {
                expect(sliceInfo.fiduSharePriceAtDrawdown).to.bignumber.eq(
                  new BN(params.BackerRewards.forceInitializeStakingRewardsPoolInfo[address].fiduSharePriceAtDrawdown)
                )
              })

              it("principalDeployedAtLastCheckpoint is correct", async () => {
                expect(sliceInfo.principalDeployedAtLastCheckpoint).to.bignumber.eq(
                  new BN(params.principalDeployedAtDrawdown)
                )
              })

              it("accumulatedRewardsPerTokenAtDrawdown is correct", async () => {
                expect(sliceInfo.accumulatedRewardsPerTokenAtDrawdown).to.bignumber.eq(
                  new BN(params.accumulatedRewardsPerToken)
                )
              })

              it("accumulatedRewardsPerTokenAtLastCheckpoint is correct", async () => {
                expect(sliceInfo.accumulatedRewardsPerTokenAtLastCheckpoint).to.bignumber.eq(
                  new BN(params.accumulatedRewardsPerToken)
                )
              })

              it("unrealizedAccumulatedRewardsPerTokenAtLastCheckpoint is correct", async () => {
                expect(sliceInfo.unrealizedAccumulatedRewardsPerTokenAtLastCheckpoint).to.bignumber.eq(
                  new BN(params.accumulatedRewardsPerToken)
                )
              })
            })
          })
        })
      })

      describe("maxInterestDollarsElligible", async () => {
        it("is correct", async () => {
          expect(await backerRewards.maxInterestDollarsEligible()).to.bignumber.eq(
            params.BackerRewards.maxInterestDollarsEligible
          )
        })
      })

      expectOwnerRole({
        toBe: async () => getProtocolOwner(),
        forContracts: ["CommunityRewards"],
      })
    })

    context("Go", () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["Go"],
      })

      expectOwnerRole({
        toBe: async () => getProtocolOwner(),
        forContracts: ["Go"],
      })

      context("getSeniorPoolIdTypes", () => {
        it("getSeniorPoolIdTypes", async () => {
          const received = await go.getSeniorPoolIdTypes()
          expect(received).deep.equal([
            await go.ID_TYPE_0(),
            await go.ID_TYPE_1(),
            await go.ID_TYPE_3(),
            await go.ID_TYPE_4(),
          ])
        })
      })
    })

    describe("TranchedPool", async () => {
      let tranchedPool: TranchedPoolInstance
      const allowedUIDTypes = [0, 1, 2, 3, 4]

      const testSetup = deployments.createFixture(async () => {
        const [, , , , , maybeBorrower] = await hre.getUnnamedAccounts()
        const borrower = asNonNullable(maybeBorrower)
        const {tranchedPool} = await createPoolWithCreditLine({
          people: {borrower, owner: await getProtocolOwner()},
          usdc,
          goldfinchFactory,
          allowedUIDTypes,
        })

        return {tranchedPool}
      })

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({tranchedPool} = await testSetup())
      })

      describe("allowedUidTypes", () => {
        mochaEach(allowedUIDTypes).it("id type %d is allowed", async (uidType: number) => {
          const sampled = await tranchedPool.allowedUIDTypes(uidType)
          expect(sampled).to.bignumber.eq(new BN(uidType))
        })
      })
    })
  })
})
