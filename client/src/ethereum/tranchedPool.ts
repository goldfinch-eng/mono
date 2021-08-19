import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {DepositMade, TranchedPool as TranchedPoolContract} from "../typechain/web3/TranchedPool"
import {CreditLine} from "./creditLine"
import {IPoolTokens} from "../typechain/web3/IPoolTokens"
import BigNumber from "bignumber.js"
import {fiduFromAtomic} from "./fidu"
import {roundDownPenny, secondsSinceEpoch} from "../utils"
import _ from "lodash"
import {ContractEventLog} from "../typechain/web3/types"
import web3 from "../web3"
import {usdcFromAtomic} from "./erc20"
import {CONFIG_KEYS} from "../../../blockchain_scripts/configKeys"
import {SeniorPool as SeniorPoolContract} from "../typechain/web3/SeniorPool"

const ZERO = new BigNumber(0)
const ONE = new BigNumber(1)
const ONE_HUNDRED = new BigNumber(100)

interface MetadataStore {
  [address: string]: PoolMetadata
}
let _metadataStore: MetadataStore
async function metadataStore(networkId: string): Promise<MetadataStore> {
  if (_metadataStore) {
    return Promise.resolve(_metadataStore)
  }
  try {
    let result = await import(`../../config/pool-metadata/${networkId}.json`)
    _metadataStore = result
    return _metadataStore
  } catch (e) {
    console.log(e)
    return {}
  }
}

interface PoolMetadata {
  name: string
  category: string
  icon: string
  description: string
  detailsUrl?: string
}

enum PoolState {
  Open,
  JuniorLocked,
  SeniorLocked,
  WithdrawalsUnlocked,
}

// TODO: copied from deployHelpers
const TRANCHES = {
  Senior: 1,
  Junior: 2,
}

interface TrancheInfo {
  id: number
  principalDeposited: BigNumber
  principalSharePrice: BigNumber
  interestSharePrice: BigNumber
  lockedUntil: number
}

function trancheInfo(tuple: any): TrancheInfo {
  return {
    id: parseInt(tuple[0]),
    principalDeposited: new BigNumber(tuple[1]),
    principalSharePrice: new BigNumber(tuple[2]),
    interestSharePrice: new BigNumber(tuple[3]),
    lockedUntil: parseInt(tuple[4]),
  }
}

class TranchedPool {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  contract: TranchedPoolContract
  creditLine!: CreditLine
  creditLineAddress!: string
  state!: PoolState
  metadata?: PoolMetadata
  juniorFeePercent!: BigNumber
  reserveFeePercent!: BigNumber
  estimatedLeverageRatio!: BigNumber
  estimatedSeniorPoolContribution!: BigNumber

  juniorTranche!: TrancheInfo
  seniorTranche!: TrancheInfo
  totalDeposited!: BigNumber

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = this.goldfinchProtocol.getContract<TranchedPoolContract>("TranchedPool", address)
  }

  async initialize() {
    this.creditLineAddress = await this.contract.methods.creditLine().call()
    this.creditLine = new CreditLine(this.creditLineAddress, this.goldfinchProtocol)
    await this.creditLine.initialize()
    this.metadata = await this.loadPoolMetadata()

    let juniorTranche = await this.contract.methods.getTranche(TRANCHES.Junior).call().then(trancheInfo)
    let seniorTranche = await this.contract.methods.getTranche(TRANCHES.Senior).call().then(trancheInfo)
    this.juniorTranche = juniorTranche
    this.seniorTranche = seniorTranche
    this.totalDeposited = juniorTranche.principalDeposited.plus(seniorTranche.principalDeposited)
    this.juniorFeePercent = new BigNumber(await this.contract.methods.juniorFeePercent().call())
    this.reserveFeePercent = new BigNumber(100).div(
      await this.goldfinchProtocol.getConfigNumber(CONFIG_KEYS.ReserveDenominator),
    )
    let pool = this.goldfinchProtocol.getContract<SeniorPoolContract>("SeniorPool")
    this.estimatedSeniorPoolContribution = new BigNumber(await pool.methods.estimateInvestment(this.address).call())
    this.estimatedLeverageRatio = await this.estimateLeverageRatio()

    let now = secondsSinceEpoch()
    if (now < seniorTranche.lockedUntil) {
      this.state = PoolState.SeniorLocked
    } else if (juniorTranche.lockedUntil === 0) {
      this.state = PoolState.Open
    } else if (now < juniorTranche.lockedUntil || seniorTranche.lockedUntil === 0) {
      this.state = PoolState.JuniorLocked
    } else {
      this.state = PoolState.WithdrawalsUnlocked
    }
  }

  private async loadPoolMetadata(): Promise<PoolMetadata | undefined> {
    let store = await metadataStore(this.goldfinchProtocol.networkId)
    return store[this.address.toLowerCase()]
  }

  estimateJuniorAPY(leverageRatio: BigNumber): BigNumber {
    // If the balance is zero (not yet drawn down, then use the limit as an estimate)
    let balance = this.creditLine.balance.isZero() ? this.creditLine.limit : this.creditLine.balance

    let seniorFraction = leverageRatio.dividedBy(ONE.plus(leverageRatio))
    let juniorFraction = ONE.dividedBy(ONE.plus(leverageRatio))
    let interestRateFraction = this.creditLine.interestAprDecimal.dividedBy(ONE_HUNDRED)
    let juniorFeeFraction = this.juniorFeePercent.dividedBy(ONE_HUNDRED)
    let reserveFeeFraction = this.reserveFeePercent.dividedBy(ONE_HUNDRED)

    let grossSeniorInterest = balance.multipliedBy(interestRateFraction).multipliedBy(seniorFraction)
    let grossJuniorInterest = balance.multipliedBy(interestRateFraction).multipliedBy(juniorFraction)
    const juniorFee = grossSeniorInterest.multipliedBy(juniorFeeFraction)
    const juniorReserveFeeOwed = grossJuniorInterest.multipliedBy(reserveFeeFraction)

    let netJuniorInterest = grossJuniorInterest.plus(juniorFee).minus(juniorReserveFeeOwed)
    let juniorTranche = balance.multipliedBy(juniorFraction)
    return netJuniorInterest.dividedBy(juniorTranche).multipliedBy(ONE_HUNDRED)
  }

  estimateMonthlyInterest(interestRate: BigNumber, principalAmount: BigNumber): BigNumber {
    let monthsPerYear = new BigNumber(12)
    return principalAmount.multipliedBy(interestRate).dividedBy(monthsPerYear)
  }

  estimatedTotalAssets(): BigNumber {
    return this.juniorTranche.principalDeposited
      .plus(this.seniorTranche.principalDeposited)
      .plus(this.estimatedSeniorPoolContribution)
  }

  remainingCapacity(): BigNumber {
    return BigNumber.maximum(ZERO, this.creditLine.limit.minus(this.estimatedTotalAssets()))
  }

  remainingJuniorCapacity(): BigNumber {
    if (this.state >= PoolState.JuniorLocked) {
      return ZERO
    }
    return this.remainingCapacity().dividedBy(this.estimatedLeverageRatio.plus(1))
  }

  async estimateLeverageRatio(): Promise<BigNumber> {
    let juniorContribution = this.juniorTranche.principalDeposited

    if (juniorContribution.isZero()) {
      let rawLeverageRatio = await this.goldfinchProtocol.getConfigNumber(CONFIG_KEYS.LeverageRatio)
      return new BigNumber(fiduFromAtomic(rawLeverageRatio))
    } else {
      return this.estimatedTotalAssets().minus(juniorContribution).dividedBy(juniorContribution)
    }
  }

  async recentTransactions() {
    let transactions = await this.goldfinchProtocol.queryEvents(this.contract, ["DrawdownMade", "PaymentApplied"])
    transactions = _.reverse(_.sortBy(transactions, "blockNumber")).slice(0, 3)
    let sharePriceUpdates = await this.sharePriceUpdatesByTx(TRANCHES.Junior)
    let blockTimestamps = await this.timestampsByBlockNumber(transactions)
    return transactions.map((e) => {
      const sharePriceUpdate = sharePriceUpdates[e.transactionHash]![0]!

      let event = {
        txHash: e.transactionHash,
        event: e.event,
        juniorInterestDelta: new BigNumber(sharePriceUpdate.returnValues.interestDelta),
        juniorPrincipalDelta: new BigNumber(sharePriceUpdate.returnValues.principalDelta),
        timestamp: blockTimestamps[e.blockNumber],
      }
      if (e.event === "DrawdownMade") {
        Object.assign(event, {
          name: "Drawdown",
          amount: new BigNumber(e.returnValues.amount),
        })
      } else if (e.event === "PaymentApplied") {
        const interestAmount = new BigNumber(e.returnValues.interestAmount)
        const totalPrincipalAmount = new BigNumber(e.returnValues.principalAmount).plus(
          new BigNumber(e.returnValues.remainingAmount),
        )
        Object.assign(event, {
          name: "Interest payment",
          amount: interestAmount.plus(totalPrincipalAmount),
          interestAmount: new BigNumber(interestAmount),
          principalAmount: new BigNumber(totalPrincipalAmount),
        })
      }
      return event
    })
  }

  sharePriceToUSDC(sharePrice: BigNumber, amount: BigNumber): BigNumber {
    return new BigNumber(fiduFromAtomic(sharePrice.multipliedBy(amount)))
  }

  async sharePriceUpdatesByTx(tranche: number) {
    let transactions = await this.goldfinchProtocol.queryEvents(this.contract, ["SharePriceUpdated"], {
      tranche: tranche,
    })
    return _.groupBy(transactions, (e) => e.transactionHash)
  }

  async timestampsByBlockNumber(transactions: ContractEventLog<any>[]) {
    const blockTimestamps = await Promise.all(
      transactions.map((tx) => {
        return web3.eth.getBlock(tx.blockNumber).then((block) => {
          return {blockNumber: tx.blockNumber, timestamp: block.timestamp}
        })
      }),
    )
    const result = {}
    blockTimestamps.map((t) => (result[t.blockNumber] = t.timestamp))
    return result
  }
}

class PoolBacker {
  address: string
  tranchedPool: TranchedPool
  goldfinchProtocol: GoldfinchProtocol

  principalAmount!: BigNumber
  principalRedeemed!: BigNumber
  interestRedeemed!: BigNumber
  principalRedeemable!: BigNumber
  interestRedeemable!: BigNumber
  balance!: BigNumber
  principalAtRisk!: BigNumber
  balanceInDollars!: BigNumber
  availableToWithdraw!: BigNumber
  availableToWithdrawInDollars!: BigNumber
  unrealizedGainsInDollars!: BigNumber
  tokenInfos!: TokenInfo[]

  constructor(address: string, tranchedPool: TranchedPool, goldfinchProtocol: GoldfinchProtocol) {
    this.address = address
    this.tranchedPool = tranchedPool
    this.goldfinchProtocol = goldfinchProtocol
  }

  async initialize() {
    let events = await this.goldfinchProtocol.queryEvent<DepositMade>(this.tranchedPool.contract, "DepositMade", {
      owner: this.address,
    })
    let tokenIds = events.map((e) => e.returnValues.tokenId)
    let poolTokens = this.goldfinchProtocol.getContract<IPoolTokens>("PoolTokens")
    this.tokenInfos = await Promise.all(
      tokenIds.map((tokenId) => {
        return poolTokens.methods
          .getTokenInfo(tokenId)
          .call()
          .then((res) => tokenInfo(tokenId, res))
      }),
    )

    let zero = new BigNumber(0)
    this.principalAmount = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.principalAmount).concat(zero))
    this.principalRedeemed = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.principalRedeemed).concat(zero))
    this.interestRedeemed = BigNumber.sum.apply(null, this.tokenInfos.map((t) => t.interestRedeemed).concat(zero))

    let availableToWithdrawAmounts = await Promise.all(
      tokenIds.map((tokenId) => this.tranchedPool.contract.methods.availableToWithdraw(tokenId).call()),
    )
    this.interestRedeemable = BigNumber.sum.apply(
      null,
      availableToWithdrawAmounts.map((a) => new BigNumber(a.interestRedeemable)).concat(zero),
    )
    this.principalRedeemable = BigNumber.sum.apply(
      null,
      availableToWithdrawAmounts.map((a) => new BigNumber(a.principalRedeemable)).concat(zero),
    )

    const unusedPrincipal = this.principalRedeemed.plus(this.principalRedeemable)
    this.principalAtRisk = this.principalAmount.minus(unusedPrincipal)
    this.balance = this.principalAmount.minus(this.principalRedeemed).plus(this.interestRedeemable)
    this.balanceInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(this.balance)))
    this.availableToWithdraw = this.interestRedeemable.plus(this.principalRedeemable)
    this.availableToWithdrawInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(this.availableToWithdraw)))
    this.unrealizedGainsInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(this.interestRedeemable)))
  }
}

interface TokenInfo {
  id: string
  pool: string
  tranche: BigNumber
  principalAmount: BigNumber
  principalRedeemed: BigNumber
  interestRedeemed: BigNumber
}

function tokenInfo(tokenId: string, tuple: any): TokenInfo {
  return {
    id: tokenId,
    pool: tuple[0],
    tranche: new BigNumber(tuple[1]),
    principalAmount: new BigNumber(tuple[2]),
    principalRedeemed: new BigNumber(tuple[3]),
    interestRedeemed: new BigNumber(tuple[4]),
  }
}

export {TranchedPool, PoolBacker, PoolState, TRANCHES}
