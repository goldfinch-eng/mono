import {deployments} from "hardhat"
import BN from "bn.js"
import {expectEvent} from "@openzeppelin/test-helpers"
import {GFIInstance} from "../typechain/truffle"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {ETHDecimals} from "../blockchain_scripts/deployHelpers"
import {deployBaseFixture} from "./util/fixtures"

describe("GFI", () => {
  let deployer: string
  let owner: string
  let notMinter: string
  let gfi: GFIInstance

  const testSetup = deployments.createFixture(async (hre, options) => {
    const {protocol_owner: owner, gf_deployer: deployer} = await hre.getNamedAccounts()
    assertNonNullable(owner)
    assertNonNullable(deployer)

    const {gfi, ...others} = await deployBaseFixture()
    const [, , maybeNotMinter] = await web3.eth.getAccounts()
    const notMinter = asNonNullable(maybeNotMinter)

    await gfi.mint(owner, new BN(10000))

    return {owner, deployer, gfi, notMinter, ...others}
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({deployer, owner, notMinter, gfi} = await testSetup())
  })

  describe("symbol", () => {
    it("is GFI", async () => {
      expect(await gfi.symbol()).to.eq("GFI")
    })
  })

  describe("name", () => {
    it("is Goldfinch", async () => {
      expect(await gfi.name()).to.eq("Goldfinch")
    })
  })

  describe("pause", () => {
    context("as owner", () => {
      it("succeeds", async () => {
        expect(gfi.pause()).not.to.be.rejected
      })
    })

    context("as deployer", () => {
      it("reverts", async () => {
        expect(gfi.pause({from: deployer})).to.be.rejectedWith(/must be pauser/i)
      })
    })
  })

  describe("unpause", () => {
    context("as owner", () => {
      it("succeeds", async () => {
        await gfi.pause({from: owner})
        expect(gfi.unpause({from: owner})).to.not.be.rejected
      })
    })

    context("as deployer", async () => {
      it("reverts", async () => {
        await gfi.pause({from: owner})
        expect(gfi.unpause({from: deployer})).to.be.rejectedWith(/must be pauser/i)
      })
    })
  })

  describe("hasRole", () => {
    describe("deployer", () => {
      it("does not have minter role", async () => {
        expect(await gfi.hasRole(await gfi.MINTER_ROLE(), deployer)).to.eq(false)
      })

      it("does not have owner role", async () => {
        expect(await gfi.hasRole(await gfi.OWNER_ROLE(), deployer)).to.eq(false)
      })

      it("does not have pauser role", async () => {
        expect(await gfi.hasRole(await gfi.PAUSER_ROLE(), deployer)).to.eq(false)
      })
    })

    describe("owner", () => {
      it("has minter role", async () => {
        expect(await gfi.hasRole(await gfi.MINTER_ROLE(), owner)).to.eq(true)
      })

      it("has owner role", async () => {
        expect(await gfi.hasRole(await gfi.OWNER_ROLE(), owner)).to.eq(true)
      })

      it("has pauser role", async () => {
        expect(await gfi.hasRole(await gfi.PAUSER_ROLE(), owner)).to.eq(true)
      })
    })
  })

  describe("cap", () => {
    it("is initially 1e26", async () => {
      const oneHundredMillion = new BN("100000000")
      const expectedCap = oneHundredMillion.mul(ETHDecimals)
      expect(await gfi.cap()).to.bignumber.eq(expectedCap)
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
      it("reverts", async () => {
        const cap = await gfi.cap({from: notMinter})
        expect(gfi.setCap(new BN(100000000000), {from: notMinter})).to.be.rejectedWith(/must be owner/i)
        expect(await gfi.cap({from: notMinter})).to.bignumber.eq(cap)
      })
    })
  })

  describe("mint", () => {
    describe("as minter", () => {
      it("reverts when minting over the cap", async () => {
        const cap = await gfi.cap({from: owner})
        const totalSupply = await gfi.totalSupply({from: owner})
        const remainingUnderCap = cap.sub(totalSupply)
        const overCap = remainingUnderCap.add(new BN(1))

        expect(gfi.mint(owner, overCap, {from: owner})).to.be.rejectedWith(/Cannot mint more than cap/i)
      })

      it("minting up to the cap succeeds", async () => {
        const initialSupply = await gfi.totalSupply({from: owner})
        const cap: BN = await gfi.cap({from: owner})
        const remainingCap = cap.sub(initialSupply)

        const initialBalance = await gfi.balanceOf(owner)
        const expectedFinalBalance = initialBalance.add(remainingCap)
        await gfi.mint(owner, remainingCap)
        expect(await gfi.balanceOf(owner)).to.bignumber.eq(expectedFinalBalance)
      })

      context("while paused", async () => {
        beforeEach(async () => {
          await gfi.pause({from: owner})
        })

        it("reverts", async () => {
          expect(gfi.mint(owner, new BN(100))).to.be.rejectedWith(/paused/i)
        })
      })
    })

    describe("not as minter", () => {
      it("minting over the cap fails", async () => {
        const totalSupply = await gfi.totalSupply({from: notMinter})
        const cap = await gfi.cap({from: notMinter})
        const remainingUnderCap = cap.sub(totalSupply)
        const overCap = remainingUnderCap.add(new BN(1))

        expect(gfi.mint(notMinter, overCap, {from: notMinter})).to.be.rejectedWith(/must be minter/i)
        expect(await gfi.cap({from: notMinter})).to.bignumber.equal(cap)
      })

      it("minting under the cap fails", async () => {
        const totalSupply = await gfi.totalSupply({from: notMinter})
        const cap = await gfi.cap({from: notMinter})
        const remainingUnderCap = cap.sub(totalSupply)
        const underCap = remainingUnderCap.sub(new BN(1))

        expect(gfi.mint(notMinter, underCap, {from: notMinter})).to.be.rejectedWith(/must be minter/i)
        expect(await gfi.cap({from: notMinter})).to.bignumber.equal(cap)
      })
    })
  })
})
