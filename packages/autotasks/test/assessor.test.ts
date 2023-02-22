import {TRANCHES} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  hardhat,
  BN,
  deployAllContracts,
  advanceTime,
  expectAction,
  erc20Approve,
  usdcVal,
  createPoolWithCreditLine,
  toEthers,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {CreditLine, ERC20, PoolTokens, SeniorPool, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {
  CreditLineInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  TranchedPoolInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {BigNumber} from "ethers/lib/ethers"
import {assessIfRequired} from "../assessor"

const {deployments, web3} = hardhat

const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const [borrower] = await web3.eth.getAccounts()
  assertNonNullable(borrower)

  const {protocol_owner: owner} = await getNamedAccounts()
  assertNonNullable(owner)

  const {seniorPool, usdc, goldfinchConfig, goldfinchFactory, poolTokens} = await deployAllContracts(deployments)

  // Setup a TranchedPool
  await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner, borrower])
  await goldfinchConfig.bulkAddToGoList([owner, borrower])
  await seniorPool.deposit(String(usdcVal(10000)), {from: owner})
  const {tranchedPool, creditLine} = await createPoolWithCreditLine({
    people: {owner, borrower},
    goldfinchFactory,
    usdc,
  })
  await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
  await tranchedPool.lockJuniorCapital({from: borrower})
  await seniorPool.invest(tranchedPool.address)
  await tranchedPool.lockPool({from: borrower})

  return {usdc, seniorPool, creditLine, tranchedPool, poolTokens, borrower}
})

let fakeTimestamp: BigNumber
async function advanceToTimestamp(timestamp: BN) {
  const newTimestamp = await advanceTime({toSecond: timestamp.toNumber()})

  // Must convert BN -> BigNumber. Autotasks are written for an ethers provider
  fakeTimestamp = BigNumber.from(newTimestamp.toString())
}

describe("assessor", () => {
  let tranchedPool: TranchedPoolInstance
  let seniorPool: SeniorPoolInstance
  let poolTokens: PoolTokensInstance
  let creditLine: CreditLineInstance
  let usdc: any // Truffle doesn't have an ERC20Instance available
  let borrower: string

  let isLateShouldThrow = false
  let isLateDidThrow = false

  let assessFunction: () => ReturnType<typeof assessIfRequired>

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({tranchedPool, creditLine, seniorPool, poolTokens, usdc, borrower} = await setupTest())

    isLateDidThrow = false

    const provider = {
      getBlock: async function () {
        return {timestamp: fakeTimestamp}
      },
    }

    const tranchedPoolAsEthers = await toEthers<TranchedPool>(tranchedPool)
    const seniorPoolAsEthers = await toEthers<SeniorPool>(seniorPool)
    const creditLineAsEthers = await toEthers<CreditLine>(creditLine)
    const poolTokensAsEthers = await toEthers<PoolTokens>(poolTokens)
    const usdcAsEthers = await toEthers<ERC20>(usdc)

    const handler = {
      get(target: CreditLine, propKey: symbol | string) {
        if (propKey === "attach") {
          // Recursively proxy CreditLine when it's attached to a new address
          return (args: string) => new Proxy(Reflect.get(target, propKey).apply(target, [args]), handler)
        }

        if (propKey === "isLate" && isLateShouldThrow) {
          isLateDidThrow = true
          throw new Error("Not implemented!")
        }

        return Reflect.get(target, propKey)
      },
    }

    const proxiedCreditLine = new Proxy(creditLineAsEthers, handler)

    assessFunction = () =>
      assessIfRequired(
        tranchedPoolAsEthers,
        proxiedCreditLine,
        provider,
        seniorPoolAsEthers,
        poolTokensAsEthers,
        usdcAsEthers
      )
  })

  describe("assessIfRequired", async () => {
    it("assesses the credit line", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})
      await tranchedPool.pay(usdcVal(1), {from: borrower})
      // Advance to just beyond the nextDueTime
      await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))
      await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {increase: true}]])
    })

    it("assesses if beyond the term end block", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})

      // Advance to just after the term due block
      await advanceToTimestamp((await creditLine.termEndTime()).add(new BN(10)))

      await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {increase: true}]])
    })

    it("does not assess if no balance", async () => {
      await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {by: "0"}]])
    })

    describe("within nextDueTime", () => {
      it("does not assess if payment was on time", async () => {
        await tranchedPool.drawdown(usdcVal(10), {from: borrower})

        // Advance to just before the next due block
        await advanceToTimestamp((await creditLine.nextDueTime()).sub(new BN(10)))

        await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {by: "0"}]])
      })

      it("does assess if the payment is late and there is USDC", async () => {
        await tranchedPool.drawdown(usdcVal(10), {from: borrower})

        await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))

        // Assesses as it's after due time and has been paid
        await usdc.transfer(creditLine.address, new BN(10), {from: borrower})
        await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {increase: true}]])

        // Assesses again as there's a payment and it's late
        await usdc.transfer(creditLine.address, new BN(10), {from: borrower})
        await expectAction(assessFunction).toChange([
          // Still due at the same time
          [creditLine.nextDueTime, {by: "0"}],
          // Uses all the USDC in the creditline to assess
          [() => usdc.balanceOf(creditLine.address), {to: "0"}],
        ])
      })

      it("does assess if the payment is late even is isLate is not implemented", async () => {
        isLateShouldThrow = true

        await tranchedPool.drawdown(usdcVal(10), {from: borrower})

        await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))

        // Assesses as it's after due time and has been paid
        await usdc.transfer(creditLine.address, new BN(10), {from: borrower})
        await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {increase: true}]])

        // Assesses again as there's a payment and it's late
        await usdc.transfer(creditLine.address, new BN(10), {from: borrower})
        await expectAction(assessFunction).toChange([
          // Still due at the same time
          [creditLine.nextDueTime, {by: "0"}],
          // Uses all the USDC in the creditline to assess
          [() => usdc.balanceOf(creditLine.address), {to: "0"}],
        ])
        expect(isLateDidThrow).to.be.true
      })

      it("does not assess if the payment is late but there is no USDC", async () => {
        await tranchedPool.drawdown(usdcVal(10), {from: borrower})

        await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))

        // Assesses as it's after due time and has been paid
        await usdc.transfer(creditLine.address, new BN(10), {from: borrower})
        await expectAction(assessFunction).toChange([[creditLine.nextDueTime, {increase: true}]])

        // Next assess does not run as there's no USDC to assess on
        expect(await assessFunction()).to.be.false
      })
    })
  })
})
