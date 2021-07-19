import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {DepositMade, TranchedPool as TranchedPoolContract} from "../typechain/web3/TranchedPool"
import {CreditLine} from "./creditLine"
import {IPoolTokens} from "../typechain/web3/IPoolTokens"
import BigNumber from "bignumber.js"
import {fiduFromAtomic} from "./fidu"
import {roundDownPenny, secondsSinceEpoch} from "../utils"

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
  principalDeposited: BigNumber
  principalSharePrice: BigNumber
  interestSharePrice: BigNumber
  lockedUntil: number
}

function trancheInfo(tuple: any): TrancheInfo {
  return {
    principalDeposited: tuple[0],
    principalSharePrice: new BigNumber(tuple[1]),
    interestSharePrice: new BigNumber(tuple[2]),
    lockedUntil: parseInt(tuple[3]),
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

  juniorTranche!: TrancheInfo
  seniorTranche!: TrancheInfo

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
    this.juniorTranche = juniorTranche
    let seniorTranche = await this.contract.methods.getTranche(TRANCHES.Senior).call().then(trancheInfo)
    this.seniorTranche = seniorTranche

    let now = secondsSinceEpoch()
    if (now < seniorTranche.lockedUntil) {
      this.state = PoolState.SeniorLocked
    } else if (now < juniorTranche.lockedUntil) {
      this.state = PoolState.JuniorLocked
    } else if (juniorTranche.lockedUntil === 0) {
      this.state = PoolState.Open
    } else {
      this.state = PoolState.WithdrawalsUnlocked
    }
  }

  private async loadPoolMetadata(): Promise<PoolMetadata | undefined> {
    let store = await metadataStore(this.goldfinchProtocol.networkId)
    return store[this.address.toLowerCase()]
  }
}

class Backer {
  address: string
  tranchedPool: TranchedPool
  goldfinchProtocol: GoldfinchProtocol

  principalAmount!: BigNumber
  principalRedeemed!: BigNumber
  interestRedeemed!: BigNumber
  availableToWithdraw!: BigNumber
  availableToWithdrawInDollars!: BigNumber

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
    let tokenInfos = await Promise.all(
      tokenIds.map((tokenId) => poolTokens.methods.getTokenInfo(tokenId).call().then(tokenInfo)),
    )

    let zero = new BigNumber(0)
    this.principalAmount = BigNumber.sum.apply(null, tokenInfos.map((t) => t.principalAmount).concat(zero))
    this.principalRedeemed = BigNumber.sum.apply(null, tokenInfos.map((t) => t.principalRedeemed).concat(zero))
    this.interestRedeemed = BigNumber.sum.apply(null, tokenInfos.map((t) => t.interestRedeemed).concat(zero))

    let availableToWithdrawAmounts = await Promise.all(
      tokenIds.map((tokenId) => this.tranchedPool.contract.methods.availableToWithdraw(tokenId).call()),
    )
    this.availableToWithdraw = BigNumber.sum.apply(
      null,
      availableToWithdrawAmounts
        .map((a) => [new BigNumber(a.interestRedeemable), new BigNumber(a.principalRedeemable)])
        .flat()
        .concat(zero),
    )
    this.availableToWithdrawInDollars = new BigNumber(roundDownPenny(fiduFromAtomic(this.availableToWithdraw)))
  }
}

interface TokenInfo {
  pool: string
  tranche: BigNumber
  principalAmount: BigNumber
  principalRedeemed: BigNumber
  interestRedeemed: BigNumber
}

function tokenInfo(tuple: any): TokenInfo {
  return {
    pool: tuple[0],
    tranche: new BigNumber(tuple[1]),
    principalAmount: new BigNumber(tuple[2]),
    principalRedeemed: new BigNumber(tuple[3]),
    interestRedeemed: new BigNumber(tuple[4]),
  }
}

export {TranchedPool, Backer, PoolState, TRANCHES}
