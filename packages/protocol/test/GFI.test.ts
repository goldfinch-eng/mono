import {deployments} from "hardhat"
import {getDeployedAsTruffleContract} from "./testHelpers"
import BN from "bn.js"
import {expectEvent} from "@openzeppelin/test-helpers"
import {GFIInstance} from "../typechain/truffle"

interface TestSetupReturn {
  gfi: GFIInstance
}

describe("GFI", () => {
  const testSetup: (options?: any) => Promise<TestSetupReturn> = deployments.createFixture(
    async ({deployments, getNamedAccounts}) => {
      const {protocol_owner: owner} = await getNamedAccounts()
      await deployments.run("base_deploy")
      const gfi = await getDeployedAsTruffleContract<GFIInstance>(deployments, "GFI")

      return {gfi}
    }
  )

  let owner: string | undefined
  let notOwner: string | undefined
  let gfi: GFIInstance
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, notOwner] = await web3.eth.getAccounts()
    const deployments = await testSetup()
    gfi = deployments.gfi
  })

  describe("symbol", () => {
    it("is GFI", async () => {
      console.log(gfi.constructor.name)
      expect(await gfi.symbol()).to.eq("GFI")
    })
  })

  describe("name", () => {
    it("is GFI", async () => {
      expect(await gfi.name()).to.eq("GFI")
    })
  })

  describe("setCap", () => {
    describe("as owner", () => {
      it("allows you to increase the cap", async () => {
        const cap = await gfi.cap({from: owner})
        const newCap = cap.add(new BN(1000000))

        await gfi.setCap(newCap, {from: owner})
        expect(await gfi.cap({from: owner})).to.bignumber.eq(newCap)
      })

      it("does not allow you to decrease the cap below the total supply", async () => {
        const totalSupply = await gfi.totalSupply({from: owner})
        const belowTotalSupply = totalSupply.sub(new BN(1))
        expect(gfi.setCap(belowTotalSupply, {from: owner})).to.be.rejected
      })

      it("emits an event", async () => {
        const cap = await gfi.cap({from: owner})
        const newCap = cap.add(new BN(1000000))

        const tx = await gfi.setCap(newCap, {from: owner})
        expectEvent(tx, "CapUpdated", {cap: newCap})
      })
    })

    describe("not as owner", () => {
      it("forbids you from using the setCap function", async () => {
        const cap = await gfi.cap({from: notOwner})
        expect(gfi.setCap(new BN(100000000000), {from: notOwner})).to.be.rejected
        expect(await gfi.cap({from: notOwner})).to.bignumber.eq(cap)
      })
    })
  })

  describe("mintTo", () => {
    describe("as owner", () => {
      it("minting over the cap fails", async () => {
        const cap = await gfi.cap({from: owner})
        const totalSupply = await gfi.totalSupply({from: owner})
        const remainingUnderCap = cap.sub(totalSupply)
        const overCap = remainingUnderCap.add(new BN(1))

        expect(gfi.mintTo(owner!, overCap, {from: owner})).to.be.rejected
      })

      it("minting up to the cap succeeds", async () => {
        const initialSupply = await gfi.totalSupply({from: owner})
        const cap: BN = await gfi.cap({from: owner})
        const remainingCap = cap.sub(initialSupply)

        const initialBalance = await gfi.balanceOf(owner!)
        const expectedFinalBalance = initialBalance.add(remainingCap)
        await gfi.mintTo(owner!, remainingCap)
        expect(await gfi.balanceOf(owner!)).to.bignumber.eq(expectedFinalBalance)
      })
    })

    describe("not as owner", () => {
      it("minting over the cap fails", async () => {
        const totalSupply = await gfi.totalSupply({from: notOwner})
        const cap = await gfi.cap({from: notOwner})
        const remainingUnderCap = cap.sub(totalSupply)
        const overCap = remainingUnderCap.add(new BN(1))

        expect(gfi.setCap(overCap, {from: notOwner})).to.be.rejected
        expect(await gfi.cap({from: notOwner})).to.bignumber.equal(cap)
      })

      it("minting under the cap fails", async () => {
        const totalSupply = await gfi.totalSupply({from: notOwner})
        const cap = await gfi.cap({from: notOwner})
        const remainingUnderCap = cap.sub(totalSupply)
        const underCap = remainingUnderCap.sub(new BN(1))

        expect(gfi.setCap(underCap, {from: notOwner})).to.be.rejected
        expect(await gfi.cap({from: notOwner})).to.bignumber.equal(cap)
      })
    })
  })
})
