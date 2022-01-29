/* global artifacts web3 */
import {expectEvent} from "@openzeppelin/test-helpers"
import {expect, bigVal, expectAction} from "./testHelpers"
import {OWNER_ROLE} from "../blockchain_scripts/deployHelpers"
import hre from "hardhat"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {deployBaseFixture} from "./util/fixtures"
const {deployments} = hre
const GoldfinchConfig = artifacts.require("GoldfinchConfig")
const Fidu = artifacts.require("Fidu")

describe("Fidu", () => {
  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    // Just to be crystal clear
    const {protocol_owner} = await getNamedAccounts()
    owner = protocol_owner

    const {fidu, goldfinchConfig} = await deployBaseFixture()

    return {fidu, goldfinchConfig}
  })

  let owner, person2, goldfinchConfig, fidu
  beforeEach(async () => {
    // Pull in our unlocked accounts
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, person2] = await web3.eth.getAccounts()
    ;({fidu, goldfinchConfig} = await testSetup())
  })

  describe("Initialization", async () => {
    beforeEach(async () => {
      goldfinchConfig = await GoldfinchConfig.new({from: owner})
      await goldfinchConfig.initialize(owner)

      fidu = await Fidu.new({from: owner})
      await fidu.__initialize__(owner, "Fidu", "FIDU", goldfinchConfig.address)
    })

    describe("initialization", async () => {
      it("should not allow it to be called twice", async () => {
        return expect(fidu.__initialize__(person2, "Fidu", "FIDU", goldfinchConfig.address)).to.be.rejectedWith(
          /has already been initialized/
        )
      })
    })

    describe("ownership", async () => {
      it("should be owned by the owner", async () => {
        expect(await fidu.hasRole(OWNER_ROLE, owner)).to.be.true
      })
    })
  })

  describe("updateGoldfinchConfig", () => {
    describe("setting it", async () => {
      it("should allow the owner to set it", async () => {
        await goldfinchConfig.setAddress(CONFIG_KEYS.GoldfinchConfig, person2)
        return expectAction(() => fidu.updateGoldfinchConfig({from: owner})).toChange([
          [() => fidu.config(), {to: person2, bignumber: false}],
        ])
      })

      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
        await goldfinchConfig.setAddress(CONFIG_KEYS.GoldfinchConfig, newConfig.address, {from: owner})
        const tx = await fidu.updateGoldfinchConfig()

        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })

      it("should disallow non-owner to set", async () => {
        return expect(fidu.updateGoldfinchConfig({from: person2})).to.be.rejectedWith(/Must have minter role/)
      })
    })
  })

  describe("mintTo", async () => {
    beforeEach(async () => {
      // Use the full deployment so we have a pool, and the
      // mintTo function doesn't fail early on the assets/liabilites check
      const deployments = await testSetup()
      fidu = deployments.fidu
    })
    it("should allow the minter to call it", async () => {
      return expect(fidu.mintTo(person2, bigVal(1), {from: owner})).to.be.fulfilled
    })
    it("should not allow anyone else to call it", async () => {
      return expect(fidu.mintTo(person2, bigVal(1), {from: person2})).to.be.rejectedWith(/minter role/)
    })
  })

  describe("burnFrom", async () => {
    beforeEach(async () => {
      // Use the full deployment so we have a pool, and the
      // burnFrom function doesn't fail early on the assets/liabilites check
      const deployments = await testSetup()
      fidu = deployments.fidu
      await fidu.mintTo(person2, bigVal(1), {from: owner})
    })

    it("should allow the minter to call it", async () => {
      return expect(fidu.burnFrom(person2, bigVal(1), {from: owner})).to.be.fulfilled
    })
    it("should not allow anyone else to call it", async () => {
      return expect(fidu.burnFrom(person2, bigVal(1), {from: person2})).to.be.rejectedWith(/minter role/)
    })
  })
})
