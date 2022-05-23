/* global web3 artifacts */
import {decodeLogs, expect, getFirstLog, toTruffle} from "./testHelpers"
import {ContractDeployer} from "../blockchain_scripts/deployHelpers"
import hre from "hardhat"
import BN from "bn.js"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {expectEvent} from "@openzeppelin/test-helpers"
const {deployments} = hre
import {TestConfigurableRoyaltyStandard} from "../typechain/ethers/TestConfigurableRoyaltyStandard"
import {TestConfigurableRoyaltyStandardInstance} from "../typechain/truffle/TestConfigurableRoyaltyStandard"
import {RoyaltyParamsSet} from "../typechain/truffle/ConfigurableRoyaltyStandard"

const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const [owner, anotherUser] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(anotherUser)

  const deployer = new ContractDeployer(console.log, hre)

  const royaltyStandard = await toTruffle<TestConfigurableRoyaltyStandardInstance>(
    await deployer.deploy<TestConfigurableRoyaltyStandard>("TestConfigurableRoyaltyStandard", {
      from: owner,
      args: [owner],
    }),
    "TestConfigurableRoyaltyStandard"
  )

  return {
    owner,
    anotherUser,
    royaltyStandard,
  }
})

export function behavesLikeConfigurableRoyaltyStandard(
  params: () => {owner: string; anotherUser: string; contract: ConfigurableRoyaltyStandard}
) {
  describe("behaves like ConfigurableRoyaltyStandard", () => {
    const FIFTY_BASIS_POINTS = new BN(String(5e15))

    let owner: string
    let anotherUser: string
    let contract: ConfigurableRoyaltyStandard

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({owner, anotherUser, contract} = params())
    })

    describe("setRoyaltyParams", async () => {
      it("is only callable by OWNER_ROLE", async () => {
        await expect(contract.setRoyaltyParams(owner, FIFTY_BASIS_POINTS, {from: anotherUser})).to.be.rejectedWith(/AD/)
      })

      it("sets receiver and royaltyPercent", async () => {
        await contract.setRoyaltyParams(owner, FIFTY_BASIS_POINTS, {from: owner})
        expect(((await contract.royaltyParams()) as any).receiver).to.eq(owner)
        expect(((await contract.royaltyParams()) as any).royaltyPercent).to.bignumber.eq(FIFTY_BASIS_POINTS)
      })

      it("emits a RoyaltyParamsSet event", async () => {
        const receipt = await contract.setRoyaltyParams(owner, FIFTY_BASIS_POINTS, {from: owner})
        const log = getFirstLog<RoyaltyParamsSet>(decodeLogs(receipt.receipt.rawLogs, contract, "RoyaltyParamsSet"))
        expect(log.args.sender).to.eq(owner)
        expect(log.args.newReceiver).to.eq(owner)
        expect(log.args.newRoyaltyPercent).to.bignumber.eq(FIFTY_BASIS_POINTS)
      })
    })

    describe("royaltyInfo", async () => {
      it("calculates percent-based royalty using configured parameters", async () => {
        await contract.setRoyaltyParams(owner, FIFTY_BASIS_POINTS, {from: owner})

        const tokenId = "1"
        const salePrice = new BN(String(100e18))
        const royaltyInfo = await contract.royaltyInfo(tokenId, salePrice)

        const expectedRoyaltyAmount = salePrice.mul(FIFTY_BASIS_POINTS).div(new BN(String(1e18)))
        expect(royaltyInfo[0]).to.eq(owner)
        expect(royaltyInfo[1]).to.bignumber.eq(expectedRoyaltyAmount)
      })
    })
  })
}

// Need to define interface manually here because ConfigurableRoyaltyStandard
// is a library and therefore doesn't have an auto-generated typechain type
interface ConfigurableRoyaltyStandard {
  royaltyInfo(
    _tokenId: number | BN | string,
    _salePrice: number | BN | string,
    txDetails?: Truffle.TransactionDetails
  ): Promise<{0: string; 1: BN}>

  royaltyParams(txDetails?: Truffle.TransactionDetails): Promise<{0: string; 1: BN}>

  setRoyaltyParams: {
    (newReceiver: string, newRoyaltyPercent: number | BN | string, txDetails?: Truffle.TransactionDetails): Promise<
      Truffle.TransactionResponse<any>
    >
    call(
      newReceiver: string,
      newRoyaltyPercent: number | BN | string,
      txDetails?: Truffle.TransactionDetails
    ): Promise<void>
    sendTransaction(
      newReceiver: string,
      newRoyaltyPercent: number | BN | string,
      txDetails?: Truffle.TransactionDetails
    ): Promise<string>
    estimateGas(
      newReceiver: string,
      newRoyaltyPercent: number | BN | string,
      txDetails?: Truffle.TransactionDetails
    ): Promise<number>
  }
}

describe("ConfigurableRoyaltyStandard", () => {
  let owner: string
  let anotherUser: string
  let contract: TestConfigurableRoyaltyStandardInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, anotherUser, royaltyStandard: contract} = await testSetup())
  })

  behavesLikeConfigurableRoyaltyStandard(() => ({
    contract,
    owner,
    anotherUser,
  }))

  describe("supportsInterface", async () => {
    it("can use constant from abstract base contract", async () => {
      const INTERFACE_ID_ERC2981 = "0x2a55205a"
      expect(await contract.supportsInterface(INTERFACE_ID_ERC2981)).to.be.true
    })
  })
})
