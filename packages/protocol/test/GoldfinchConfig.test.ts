/* global artifacts web3 */
import {expect, expectAction, BN} from "./testHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {OWNER_ROLE, PAUSER_ROLE, GO_LISTER_ROLE} from "../blockchain_scripts/deployHelpers"
const GoldfinchConfig = artifacts.require("GoldfinchConfig")
const TestTheConfig = artifacts.require("TestTheConfig")
const TOTAL_FUNDS_LIMIT_KEY = CONFIG_KEYS.TotalFundsLimit
const TRANSACTION_LIMIT_KEY = CONFIG_KEYS.TransactionLimit

describe("GoldfinchConfig", () => {
  let owner, person2, person3, goldfinchConfig, accounts

  const baseSetupTest = async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3] = accounts

    goldfinchConfig = await GoldfinchConfig.new({from: owner})
    await goldfinchConfig.initialize(owner)
  }

  beforeEach(async () => {
    await baseSetupTest()
  })

  describe("ownership", async () => {
    it("should be owned by the owner", async () => {
      expect(await goldfinchConfig.hasRole(OWNER_ROLE, owner)).to.be.true
    })
    it("should give owner the PAUSER_ROLE", async () => {
      expect(await goldfinchConfig.hasRole(PAUSER_ROLE, owner)).to.be.true
    })
    it("should give owner the GO_LISTER_ROLE", async () => {
      expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.be.true
    })
  })

  describe("the order of the enum...", async () => {
    let testTheConfigContract
    beforeEach(async () => {
      testTheConfigContract = await TestTheConfig.new({from: owner})
      await goldfinchConfig.grantRole(OWNER_ROLE, testTheConfigContract.address, {from: owner})
    })
    it("should never change", async () => {
      await testTheConfigContract.testTheEnums(goldfinchConfig.address)

      // The expected values here are just hardcoded in the test enums contract
      // The whole point here is to assure we have a test that fails if we change the order
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.TransactionLimit)).to.bignumber.equal(new BN(1))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.TotalFundsLimit)).to.bignumber.equal(new BN(2))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.MaxUnderwriterLimit)).to.bignumber.equal(new BN(3))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.ReserveDenominator)).to.bignumber.equal(new BN(4))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.WithdrawFeeDenominator)).to.bignumber.equal(new BN(5))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.LatenessGracePeriodInDays)).to.bignumber.equal(new BN(6))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.LatenessMaxDays)).to.bignumber.equal(new BN(7))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)).to.bignumber.equal(new BN(8))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.TransferPeriodRestrictionInDays)).to.bignumber.equal(new BN(9))
      expect(await goldfinchConfig.getNumber(CONFIG_KEYS.LeverageRatio)).to.bignumber.equal(new BN(10))

      // Addresses
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.Pool)).to.equal("0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE")
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.GoldfinchFactory)).to.equal(
        "0x0afFE1972479c386A2Ab21a27a7f835361B6C0e9"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditDesk)).to.equal(
        "0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)).to.equal(
        "0xECd9C93B79AE7C1591b1fB5323BD777e86E150d5"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.TrustedForwarder)).to.equal(
        "0x956868751Cc565507B3B58E53a6f9f41B56bed74"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CUSDCContract)).to.equal(
        "0x5B281A6DdA0B271e91ae35DE655Ad301C976edb1"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.GoldfinchConfig)).to.equal(
        "0x0000000000000000000000000000000000000008"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.FiduUSDCCurveLP)).to.equal(
        "0x55A8a39bc9694714E2874c1ce77aa1E599461E18"
      )
    })
  })

  describe("initializeFromOtherConfig", async () => {
    it("should copy over the vals from the other config", async () => {
      const newGoldfinchConfig = await GoldfinchConfig.new({from: owner})
      await newGoldfinchConfig.initialize(owner)

      const randomAddress1 = person2
      const randomAddress2 = person3
      const randomNumber1 = new BN(42)
      const randomNumber2 = new BN(84)
      // Just doing the first 4 to show the looping works
      await goldfinchConfig.setAddress(0, randomAddress1, {from: owner})
      await goldfinchConfig.setAddress(1, randomAddress2, {from: owner})
      await goldfinchConfig.setAddress(2, randomAddress1, {from: owner})
      await goldfinchConfig.setAddress(3, randomAddress2, {from: owner})

      // Just doing the first 4 to show the looping works
      await goldfinchConfig.setNumber(0, randomNumber1, {from: owner})
      await goldfinchConfig.setNumber(1, randomNumber2, {from: owner})
      await goldfinchConfig.setNumber(2, randomNumber1, {from: owner})
      await goldfinchConfig.setNumber(3, randomNumber2, {from: owner})

      await expectAction(() => newGoldfinchConfig.initializeFromOtherConfig(goldfinchConfig.address, 4, 4)).toChange([
        [async () => await newGoldfinchConfig.getAddress(0), {to: randomAddress1, bignumber: false}],
        [async () => await newGoldfinchConfig.getAddress(1), {to: randomAddress2, bignumber: false}],
        [async () => await newGoldfinchConfig.getAddress(2), {to: randomAddress1, bignumber: false}],
        [async () => await newGoldfinchConfig.getAddress(3), {to: randomAddress2, bignumber: false}],

        [async () => await newGoldfinchConfig.getNumber(0), {to: randomNumber1}],
        [async () => await newGoldfinchConfig.getNumber(1), {to: randomNumber2}],
        [async () => await newGoldfinchConfig.getNumber(2), {to: randomNumber1}],
        [async () => await newGoldfinchConfig.getNumber(3), {to: randomNumber2}],
      ])
    })
  })

  describe("setAddress", async () => {
    let address
    beforeEach(() => {
      // Just using a random address for testing purposes
      address = person3
    })
    it("should fail if it isn't the owner", async () => {
      return expect(goldfinchConfig.setAddress(CONFIG_KEYS.Pool, address, {from: person2})).to.be.rejectedWith(
        /Must have admin role/
      )
    })

    it("should set the address", async () => {
      await goldfinchConfig.setAddress(CONFIG_KEYS.Pool, address, {from: owner})
      const newAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.Pool)
      expect(newAddress).to.equal(address)
    })

    it("should set the address only once", async () => {
      await goldfinchConfig.setAddress(CONFIG_KEYS.Pool, address, {from: owner})
      const newAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.Pool)

      const anotherAddress = person2
      await expect(goldfinchConfig.setAddress(CONFIG_KEYS.Pool, anotherAddress, {from: owner})).to.be.rejectedWith(
        /already been initialized/
      )
      // It was not updated
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.Pool)).to.equal(newAddress)
    })

    it("should fire an event", async () => {
      const result = await goldfinchConfig.setAddress(CONFIG_KEYS.Pool, address, {from: owner})
      const event = result.logs[0]

      expect(event.event).to.equal("AddressUpdated")
      expect(event.args.owner).to.equal(owner)
      expect(event.args.index).to.bignumber.equal(new BN(0))
      expect(event.args.oldValue).to.match(/0x0000000/)
      expect(event.args.newValue).to.equal(address)
    })
  })

  describe("setTreasuryReserve", async () => {
    context("not admin", async () => {
      it("reverts", async () => {
        const address = "0x0000000000000000000000000000000000000001"
        await expect(goldfinchConfig.setTreasuryReserve(address, {from: person2})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })

    it("allows setting multiple times", async () => {
      const firstAddress = "0x0000000000000000000000000000000000000001"
      const secondAddress = "0x0000000000000000000000000000000000000002"

      await expectAction(() => goldfinchConfig.setTreasuryReserve(firstAddress, {from: owner})).toChange([
        [() => goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve), {to: firstAddress, bignumber: false}],
      ])
      await expectAction(() => goldfinchConfig.setTreasuryReserve(secondAddress, {from: owner})).toChange([
        [() => goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve), {to: secondAddress, bignumber: false}],
      ])
    })
  })

  describe("setSeniorPoolStrategy", async () => {
    context("not admin", async () => {
      it("reverts", async () => {
        const address = "0x0000000000000000000000000000000000000001"
        await expect(goldfinchConfig.setSeniorPoolStrategy(address, {from: person2})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })

    it("allows setting multiple times", async () => {
      const firstAddress = "0x0000000000000000000000000000000000000001"
      const secondAddress = "0x0000000000000000000000000000000000000002"

      await expectAction(() => goldfinchConfig.setSeniorPoolStrategy(firstAddress, {from: owner})).toChange([
        [() => goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy), {to: firstAddress, bignumber: false}],
      ])
      await expectAction(() => goldfinchConfig.setSeniorPoolStrategy(secondAddress, {from: owner})).toChange([
        [() => goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy), {to: secondAddress, bignumber: false}],
      ])
    })
  })

  describe("setNumber", async () => {
    describe("setting totalFundsLimit", async () => {
      const limit = new BN(1000)
      it("should fail if it isn't the owner", async () => {
        return expect(goldfinchConfig.setNumber(TOTAL_FUNDS_LIMIT_KEY, limit, {from: person2})).to.be.rejectedWith(
          /Must have admin role/
        )
      })

      it("should set the limit", async () => {
        await goldfinchConfig.setNumber(TOTAL_FUNDS_LIMIT_KEY, limit)
        const newLimit = await goldfinchConfig.getNumber(TOTAL_FUNDS_LIMIT_KEY)
        expect(newLimit).to.bignumber.equal(limit)
      })

      it("should fire an event", async () => {
        const result = await goldfinchConfig.setNumber(TOTAL_FUNDS_LIMIT_KEY, limit)
        const event = result.logs[0]

        expect(event.event).to.equal("NumberUpdated")
        expect(event.args.owner).to.equal(owner)
        expect(event.args.index).to.bignumber.equal(new BN(1))
        expect(event.args.oldValue).to.bignumber.equal(new BN(0))
        expect(event.args.newValue).to.bignumber.equal(new BN(limit))
      })

      describe("or the transaction limit", async () => {
        const limit = new BN(1000)
        it("should fail if it isn't the owner", async () => {
          return expect(goldfinchConfig.setNumber(TRANSACTION_LIMIT_KEY, limit, {from: person2})).to.be.rejectedWith(
            /Must have admin role/
          )
        })

        it("should set the limit", async () => {
          await goldfinchConfig.setNumber(TRANSACTION_LIMIT_KEY, limit, {from: owner})
          const newLimit = await goldfinchConfig.getNumber(0)
          expect(newLimit).to.bignumber.equal(new BN(limit))
        })

        it("should fire an event", async () => {
          const result = await goldfinchConfig.setNumber(TRANSACTION_LIMIT_KEY, limit)
          const event = result.logs[0]

          expect(event.event).to.equal("NumberUpdated")
          expect(event.args.owner).to.equal(owner)
          expect(event.args.index).to.bignumber.equal(new BN(0))
          expect(event.args.oldValue).to.bignumber.equal(new BN(0))
          expect(event.args.newValue).to.bignumber.equal(new BN(limit))
        })
      })
    })
  })

  describe("go listing", async () => {
    describe("addToGoList", async () => {
      beforeEach(async () => {
        await baseSetupTest()
      })

      it("should add someone to the go list", async () => {
        expect(await goldfinchConfig.goList(person2)).to.be.false
        await goldfinchConfig.addToGoList(person2)
        expect(await goldfinchConfig.goList(person2)).to.be.true
      })
      it("should allow the owner, as a go-lister, to add someone", async () => {
        const ownerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)
        expect(ownerGoLister).to.be.true
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.false
        return expect(goldfinchConfig.addToGoList(person2, {from: owner})).to.be.fulfilled
      })
      it("should allow a non-owner, as a go-lister, to add someone", async () => {
        await goldfinchConfig.grantRole(GO_LISTER_ROLE, person3, {from: owner})
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person3)
        expect(nonOwnerGoLister).to.be.true
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.false
        return expect(goldfinchConfig.addToGoList(person2, {from: person3})).to.be.fulfilled
      })
      it("should dis-allow a non-owner who is not a go-lister from adding someone", async () => {
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person2)
        expect(nonOwnerGoLister).to.be.false
        const goListed = await goldfinchConfig.goList(person3)
        expect(goListed).to.be.false
        return expect(goldfinchConfig.addToGoList(person3, {from: person2})).to.be.rejectedWith(
          /Must have go-lister role to perform this action/
        )
      })
    })

    describe("bulkAddToGoList", async () => {
      beforeEach(async () => {
        await baseSetupTest()
      })

      it("should add many people to the go list", async () => {
        expect(await goldfinchConfig.goList(person2)).to.be.false
        expect(await goldfinchConfig.goList(person3)).to.be.false

        await goldfinchConfig.bulkAddToGoList([person2, person3])

        expect(await goldfinchConfig.goList(person2)).to.be.true
        expect(await goldfinchConfig.goList(person3)).to.be.true
      })
      it("should allow the owner, as a go-lister, to add someone", async () => {
        const ownerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)
        expect(ownerGoLister).to.be.true
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.false
        return expect(goldfinchConfig.bulkAddToGoList([person2], {from: owner})).to.be.fulfilled
      })
      it("should allow a non-owner, as a go-lister, to add someone", async () => {
        await goldfinchConfig.grantRole(GO_LISTER_ROLE, person3, {from: owner})
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person3)
        expect(nonOwnerGoLister).to.be.true
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.false
        return expect(goldfinchConfig.bulkAddToGoList([person2], {from: person3})).to.be.fulfilled
      })
      it("should dis-allow a non-owner who is not a go-lister from adding someone", async () => {
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person2)
        expect(nonOwnerGoLister).to.be.false
        const goListed = await goldfinchConfig.goList(person3)
        expect(goListed).to.be.false
        return expect(goldfinchConfig.bulkAddToGoList([person3], {from: person2})).to.be.rejectedWith(
          /Must have go-lister role to perform this action/
        )
      })
    })

    describe("removeFromGoList", async () => {
      beforeEach(async () => {
        await baseSetupTest()
      })

      it("should remove someone from the go list", async () => {
        await goldfinchConfig.addToGoList(person2)
        expect(await goldfinchConfig.goList(person2)).to.be.true
        await goldfinchConfig.removeFromGoList(person2)
        expect(await goldfinchConfig.goList(person2)).to.be.false
      })
      it("should allow the owner, as a go-lister, to remove someone", async () => {
        const ownerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)
        expect(ownerGoLister).to.be.true
        await goldfinchConfig.addToGoList(person2)
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.true
        return expect(goldfinchConfig.removeFromGoList(person2, {from: owner})).to.be.fulfilled
      })
      it("should allow a non-owner, as a go-lister, to remove someone", async () => {
        await goldfinchConfig.grantRole(GO_LISTER_ROLE, person3, {from: owner})
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person3)
        expect(nonOwnerGoLister).to.be.true
        await goldfinchConfig.addToGoList(person2)
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.true
        return expect(goldfinchConfig.removeFromGoList(person2, {from: person3})).to.be.fulfilled
      })
      it("should dis-allow a non-owner who is not a go-lister from removing someone", async () => {
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person2)
        expect(nonOwnerGoLister).to.be.false
        await goldfinchConfig.addToGoList(person3)
        const goListed = await goldfinchConfig.goList(person3)
        expect(goListed).to.be.true
        return expect(goldfinchConfig.removeFromGoList(person3, {from: person2})).to.be.rejectedWith(
          /Must have go-lister role to perform this action/
        )
      })
    })

    describe("bulkRemoveFromGoList", async () => {
      beforeEach(async () => {
        await baseSetupTest()
      })

      it("should remove someone from the go list", async () => {
        await goldfinchConfig.bulkAddToGoList([person2, person3])
        expect(await goldfinchConfig.goList(person2)).to.be.true
        expect(await goldfinchConfig.goList(person3)).to.be.true

        await goldfinchConfig.bulkRemoveFromGoList([person2, person3])
        expect(await goldfinchConfig.goList(person2)).to.be.false
        expect(await goldfinchConfig.goList(person3)).to.be.false
      })
      it("should allow the owner, as a go-lister, to remove someone", async () => {
        const ownerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)
        expect(ownerGoLister).to.be.true
        await goldfinchConfig.bulkAddToGoList([person2])
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.true
        return expect(goldfinchConfig.bulkRemoveFromGoList([person2], {from: owner})).to.be.fulfilled
      })
      it("should allow a non-owner, as a go-lister, to remove someone", async () => {
        await goldfinchConfig.grantRole(GO_LISTER_ROLE, person3, {from: owner})
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person3)
        expect(nonOwnerGoLister).to.be.true
        await goldfinchConfig.bulkAddToGoList([person2])
        const goListed = await goldfinchConfig.goList(person2)
        expect(goListed).to.be.true
        return expect(goldfinchConfig.bulkRemoveFromGoList([person2], {from: person3})).to.be.fulfilled
      })
      it("should dis-allow a non-owner who is not a go-lister from removing someone", async () => {
        const nonOwnerGoLister = await goldfinchConfig.hasRole(GO_LISTER_ROLE, person2)
        expect(nonOwnerGoLister).to.be.false
        await goldfinchConfig.bulkAddToGoList([person3])
        const goListed = await goldfinchConfig.goList(person3)
        expect(goListed).to.be.true
        return expect(goldfinchConfig.bulkRemoveFromGoList([person3], {from: person2})).to.be.rejectedWith(
          /Must have go-lister role to perform this action/
        )
      })
    })
  })
})
