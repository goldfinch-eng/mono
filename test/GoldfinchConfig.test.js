/* global artifacts web3 */
const {expect, BN} = require("./testHelpers.js")
const {CONFIG_KEYS, OWNER_ROLE} = require("../blockchain_scripts/deployHelpers")
const ConfigOptions = artifacts.require("ConfigOptions")
const GoldfinchConfig = artifacts.require("GoldfinchConfig")
const TestTheConfig = artifacts.require("TestTheConfig")
const TOTAL_FUNDS_LIMIT_KEY = CONFIG_KEYS.TotalFundsLimit
const TRANSACTION_LIMIT_KEY = CONFIG_KEYS.TransactionLimit

describe("GoldfinchConfig", () => {
  before(async () => {
    configOptions = await ConfigOptions.new({from: owner})
    GoldfinchConfig.link(configOptions)
  })
  let owner, person2, person3, goldfinchConfig, accounts, configOptions
  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3] = accounts

    goldfinchConfig = await GoldfinchConfig.new({from: owner})
    await goldfinchConfig.initialize(owner)
  })

  describe("ownership", async () => {
    it("should be owned by the owner", async () => {
      expect(await goldfinchConfig.hasRole(OWNER_ROLE, owner)).to.be.true
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

      // Addresses
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.Pool)).to.equal("0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE")
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditLineImplementation)).to.equal(
        "0xc783df8a850f42e7F7e57013759C285caa701eB6"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.GoldfinchProxyFactory)).to.equal(
        "0x0afFE1972479c386A2Ab21a27a7f835361B6C0e9"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditDesk)).to.equal(
        "0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)).to.equal(
        "0xECd9C93B79AE7C1591b1fB5323BD777e86E150d5"
      )
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.BorrowerImplementation)).to.equal(
        "0x320712AB6303602Ed03E04c8550101D49A6fb738"
      )
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

      let anotherAddress = person2
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
      expect(event.args.name).to.bignumber.equal("Pool")
      expect(event.args.oldValue).to.match(/0x0000000/)
      expect(event.args.newValue).to.equal(address)
    })
  })

  describe("setCreditLineImplementation", async () => {
    it("should update the credit line implementation", async () => {
      // Just using a random address for testing purposes
      let address = person3
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditLineImplementation)).to.not.equal(address)

      await goldfinchConfig.setCreditLineImplementation(address, {from: owner})

      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.CreditLineImplementation)).to.equal(address)
    })
  })

  describe("setNumber", async () => {
    describe("setting totalFundsLimit", async () => {
      let limit = new BN(1000)
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
        expect(event.args.name).to.bignumber.equal("TotalFundsLimit")
        expect(event.args.oldValue).to.bignumber.equal(new BN(0))
        expect(event.args.newValue).to.bignumber.equal(new BN(limit))
      })

      describe("or the transaction limit", async () => {
        let limit = new BN(1000)
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
          expect(event.args.name).to.bignumber.equal("TransactionLimit")
          expect(event.args.oldValue).to.bignumber.equal(new BN(0))
          expect(event.args.newValue).to.bignumber.equal(new BN(limit))
        })
      })
    })
  })
})
