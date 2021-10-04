import {deployments} from "hardhat"
import {getDeployedAsTruffleContract} from "./testHelpers"
import BN from "bn.js"
import {expectEvent} from "@openzeppelin/test-helpers"
import {GFIInstance} from "../typechain/truffle"

interface TestSetupReturn {
  gfi: GFIInstance
}

describe("GFI", () => {
  let deployer: string | undefined
  let owner: string | undefined
  let notMinter: string | undefined
  let gfi: GFIInstance

  const testSetup: (options?: any) => Promise<TestSetupReturn> = deployments.createFixture(
    async ({deployments, getNamedAccounts}) => {
      const {protocol_owner: owner, gf_deployer} = await getNamedAccounts()
      deployer = gf_deployer
      await deployments.run("base_deploy")
      const gfi = await getDeployedAsTruffleContract<GFIInstance>(deployments, "GFI")

      return {gfi}
    }
  )

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, , notMinter] = await web3.eth.getAccounts()
    const deployments = await testSetup()
    gfi = deployments.gfi
    await gfi.mint(owner!, new BN(10000))
  })

  describe("symbol", () => {
    it("is GFI", async () => {
      expect(await gfi.symbol()).to.eq("GFI")
    })
  })

  describe("name", () => {
    it("is GFI", async () => {
      expect(await gfi.name()).to.eq("GFI")
    })
  })

  describe("hasRole", () => {
    describe("as deployer", () => {
      it("does not have minter role", async () => {
        expect(await gfi.hasRole(await gfi.MINTER_ROLE(), deployer!)).to.eq(false)
      })

      it("does not have owner role", async () => {
        expect(await gfi.hasRole(await gfi.OWNER_ROLE(), deployer!)).to.eq(false)
      })

      it("does not have pauser role", async () => {
        expect(await gfi.hasRole(await gfi.PAUSER_ROLE(), deployer!)).to.eq(false)
      })
    })

    describe("as owner", () => {
      it("has minter role", async () => {
        expect(await gfi.hasRole(await gfi.MINTER_ROLE(), owner!)).to.eq(true)
      })

      it("has owner role", async () => {
        expect(await gfi.hasRole(await gfi.OWNER_ROLE(), owner!)).to.eq(true)
      })

      it("has pauser role", async () => {
        expect(await gfi.hasRole(await gfi.PAUSER_ROLE(), owner!)).to.eq(true)
      })
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
        expect(gfi.setCap(belowTotalSupply, {from: owner})).to.be.rejectedWith(
          /cannot decrease the cap below existing supply/i
        )
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
        const cap = await gfi.cap({from: notMinter})
        expect(gfi.setCap(new BN(100000000000), {from: notMinter})).to.be.rejectedWith(/must be owner/i)
        expect(await gfi.cap({from: notMinter})).to.bignumber.eq(cap)
      })
    })
  })

  describe("mint", () => {
    describe("as minter", () => {
      it("minting over the cap fails", async () => {
        const cap = await gfi.cap({from: owner})
        const totalSupply = await gfi.totalSupply({from: owner})
        const remainingUnderCap = cap.sub(totalSupply)
        const overCap = remainingUnderCap.add(new BN(1))

        expect(gfi.mint(owner!, overCap, {from: owner})).to.be.rejectedWith(/Cannot mint more than cap/i)
      })

      it("minting up to the cap succeeds", async () => {
        const initialSupply = await gfi.totalSupply({from: owner})
        const cap: BN = await gfi.cap({from: owner})
        const remainingCap = cap.sub(initialSupply)

        const initialBalance = await gfi.balanceOf(owner!)
        const expectedFinalBalance = initialBalance.add(remainingCap)
        await gfi.mint(owner!, remainingCap)
        expect(await gfi.balanceOf(owner!)).to.bignumber.eq(expectedFinalBalance)
      })
    })

    describe("not as minter", () => {
      it("minting over the cap fails", async () => {
        const totalSupply = await gfi.totalSupply({from: notMinter})
        const cap = await gfi.cap({from: notMinter})
        const remainingUnderCap = cap.sub(totalSupply)
        const overCap = remainingUnderCap.add(new BN(1))

        expect(gfi.mint(notMinter!, overCap, {from: notMinter})).to.be.rejectedWith(/must be minter/i)
        expect(await gfi.cap({from: notMinter})).to.bignumber.equal(cap)
      })

      it("minting under the cap fails", async () => {
        const totalSupply = await gfi.totalSupply({from: notMinter})
        const cap = await gfi.cap({from: notMinter})
        const remainingUnderCap = cap.sub(totalSupply)
        const underCap = remainingUnderCap.sub(new BN(1))

        expect(gfi.mint(notMinter!, underCap, {from: notMinter})).to.be.rejectedWith(/must be minter/i)
        expect(await gfi.cap({from: notMinter})).to.bignumber.equal(cap)
      })
    })
  })
})
