import BN from "bn.js"
import {asNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
import {FIDU_DECIMALS, interestAprAsBN} from "../blockchain_scripts/deployHelpers"
import {
  ERC20Instance,
  FiduInstance,
  GoldfinchConfigInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  TransporterInstance,
} from "../typechain/truffle"
import {
  bigVal,
  createPoolWithCreditLine,
  decodeLogs,
  erc20Approve,
  erc20Transfer,
  fiduToUSDC,
  getFirstLog,
  usdcVal,
} from "./testHelpers"
import {deployBaseFixture} from "./util/fixtures"
import {DepositMade} from "../typechain/truffle/SeniorPool"
import {Staked} from "../typechain/truffle/StakingRewards"
const {ethers, deployments} = hre

const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const [_owner, _investor, _borrower] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const investor = asNonNullable(_investor)
  const borrower = asNonNullable(_borrower)

  const {goldfinchConfig, goldfinchFactory, seniorPool, gfi, stakingRewards, fidu, usdc, transporter, ...others} =
    await deployBaseFixture()

  await stakingRewards.initTransporterRole()
  await seniorPool.initTransporterRole()
  await stakingRewards.grantRole(await stakingRewards.TRANSPORTER_ROLE(), transporter.address)
  await seniorPool.grantRole(await seniorPool.TRANSPORTER_ROLE(), transporter.address)

  await goldfinchConfig.bulkAddToGoList([owner, investor, borrower])
  await erc20Approve(usdc, investor, usdcVal(10000), [owner])
  await erc20Transfer(usdc, [investor], usdcVal(10000), owner)

  await erc20Approve(usdc, seniorPool.address, usdcVal(5000), [investor])
  const receipt = await seniorPool.deposit(usdcVal(5000), {from: investor})
  const depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
  const fiduAmount = new BN(depositEvent.args.shares)

  const targetCapacity = bigVal(1000)
  const maxRate = bigVal(1000)
  const minRate = bigVal(100)
  const maxRateAtPercent = new BN(5).mul(new BN(String(1e17))) // 50%
  const minRateAtPercent = new BN(3).mul(new BN(String(1e18))) // 300%

  await stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent)

  const limit = usdcVal(1_000_000)
  const interestApr = interestAprAsBN("5.00")
  const paymentPeriodInDays = new BN(30)
  const termInDays = new BN(365)
  const lateFeeApr = new BN(0)
  const juniorFeePercent = new BN(20)
  const {tranchedPool} = await createPoolWithCreditLine({
    people: {owner, borrower},
    goldfinchFactory,
    juniorFeePercent,
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    usdc,
  })

  return {
    ...others,
    fidu,
    owner,
    borrower,
    investor,
    fiduAmount,
    transporter,
    goldfinchConfig,
    seniorPool,
    stakingRewards,
    tranchedPool,
  }
})

describe("Transporter", async () => {
  let transporter: TransporterInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let seniorPool: SeniorPoolInstance
  let stakingRewards: StakingRewardsInstance
  let tranchedPool: TranchedPoolInstance
  let fidu: FiduInstance
  let usdc: ERC20Instance
  let poolTokens: PoolTokensInstance

  let owner: string
  let investor: string

  let fiduAmount: BN

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      investor,
      fiduAmount,
      poolTokens,
      goldfinchConfig,
      tranchedPool,
      seniorPool,
      transporter,
      stakingRewards,
      fidu,
    } = await testSetup())
  })

  describe.only("moveStakeToTranchedPool", async () => {
    it("works", async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      const receipt = await stakingRewards.stake(fiduAmount, {from: investor})
      const stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
        .tokenId

      const usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
      const usdcToTransport = usdcEquivalent.div(new BN(2))

      await transporter.moveStakeToTranchedPool(stakedTokenId, tranchedPool.address, 1, usdcToTransport, {
        from: investor,
      })

      expect(poolTokens.balanceOf(investor)).to.bignumber.eq(new BN(1))
    })
  })
})
