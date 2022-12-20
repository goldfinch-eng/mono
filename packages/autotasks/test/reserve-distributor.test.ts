import chai from "chai"
import hre from "hardhat"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {getProtocolOwner} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {hardhat} from "@goldfinch-eng/protocol"
import {bigVal, deployAllContracts, erc20Transfer, usdcVal} from "@goldfinch-eng/protocol/test/testHelpers"
const {deployments} = hardhat
import * as reserveDistributor from "../reserve-distributor"
import {assertNonNullable} from "packages/utils/src/type"
import {
  ERC20Instance,
  ERC20SplitterInstance,
  FiduInstance,
  MembershipCollectorInstance,
} from "packages/protocol/typechain/truffle"
import {ERC20Splitter} from "@goldfinch-eng/protocol/typechain/ethers"
import {ethers} from "ethers"

const {ERC20_SPLITTER_ABI} = reserveDistributor

const TEST_TIMEOUT = 30000

const setupTest = deployments.createFixture(async ({deployments}) => {
  const protocolOwner = await getProtocolOwner()
  assertNonNullable(protocolOwner)

  const {fidu, usdc, reserveSplitter, membershipCollector} = await deployAllContracts(deployments)
  return {fidu, usdc, reserveSplitter, membershipCollector, protocolOwner}
})

describe("reserve-distributor", async function () {
  this.timeout(TEST_TIMEOUT)

  let protocolOwner: string
  let reserveSplitter: ERC20SplitterInstance
  let membershipCollector: MembershipCollectorInstance
  let ethersReserveSplitter: ERC20Splitter
  let usdc: ERC20Instance
  let fidu: FiduInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({fidu, usdc, protocolOwner, reserveSplitter, membershipCollector} = await setupTest())
    const signer = hre.ethers.provider.getSigner(await getProtocolOwner())
    ethersReserveSplitter = new ethers.Contract(reserveSplitter.address, ERC20_SPLITTER_ABI, signer) as ERC20Splitter
  })

  describe("main", async () => {
    it("calls distribute", async () => {
      await erc20Transfer(usdc, [reserveSplitter.address], usdcVal(100_000), protocolOwner)

      // Test setup gives protocolOwner all USDC, so we use before/after checks to ensure protocolOwner
      // balance is correctly updated using the splittr.
      const protocolOwnerBalanceBefore = await usdc.balanceOf(protocolOwner)

      await reserveDistributor.main({splitter: ethersReserveSplitter})

      const protocolOwnerBalanceAfter = await usdc.balanceOf(protocolOwner)
      const protocolOwnerBalanceDiff = protocolOwnerBalanceAfter.sub(protocolOwnerBalanceBefore)

      expect(protocolOwnerBalanceDiff).to.bignumber.eq(usdcVal(50_000))
      // Assuming share price of 1.0
      expect(await fidu.balanceOf(membershipCollector.address)).to.bignumber.eq(bigVal(50_000))
    })
  })
})
