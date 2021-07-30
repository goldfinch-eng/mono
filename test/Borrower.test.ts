/* global artifacts web3 ethers */
import BN from "bn.js"
import hre from "hardhat"
const {deployments, ethers} = hre
import {
  usdcVal,
  deployAllContracts,
  erc20Transfer,
  erc20Approve,
  expectAction,
  getBalance,
  expect,
  ZERO_ADDRESS,
  advanceTime,
  createPoolWithCreditLine as _createPoolWithCreditLine,
} from "./testHelpers"
import {TRANCHES} from "../blockchain_scripts/deployHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {TypedDataUtils, signTypedData_v4, TypedMessage} from "eth-sig-util"
import {bufferToHex} from "ethereumjs-util"
import {BorrowerInstance} from "../typechain/truffle/Borrower.js"
const Borrower = artifacts.require("Borrower")

describe("Borrower", async () => {
  let owner,
    bwr,
    bwrCon,
    goldfinchConfig,
    usdc,
    tranchedPool,
    goldfinchFactory,
    cl,
    accounts,
    person3,
    underwriter,
    reserve,
    forwarder

  const createPoolWithCreditLine = async (_bwrCon?: BorrowerInstance) => {
    const bwrConToUse = bwrCon || _bwrCon
    let res = await _createPoolWithCreditLine({
      people: {owner, borrower: bwrConToUse.address},
      goldfinchFactory,
      usdc,
    })

    // Ready the pool for drawdown
    await res.tranchedPool.deposit(TRANCHES.Junior, usdcVal(2000))
    await bwrConToUse.lockJuniorCapital(res.tranchedPool.address, {from: bwr})
    await res.tranchedPool.deposit(TRANCHES.Senior, usdcVal(8000))
    await bwrConToUse.lockPool(res.tranchedPool.address, {from: bwr})

    return res
  }

  const createBorrowerContract = async (_borrower) => {
    const result = await goldfinchFactory.createBorrower(_borrower)
    let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
    let contract = await Borrower.at(bwrConAddr)
    await erc20Approve(usdc, contract.address, usdcVal(100000), [_borrower])
    return contract
  }

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {
      seniorPool,
      usdc,
      creditDesk,
      fidu,
      goldfinchConfig,
      goldfinchFactory,
      forwarder,
    } = await deployAllContracts(deployments, {deployForwarder: true, fromAccount: owner})
    // Approve transfers for our test accounts
    await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner, bwr, person3])
    await goldfinchConfig.bulkAddToGoList([owner, bwr, person3, underwriter, reserve])
    // Some housekeeping so we have a usable creditDesk for tests, and a seniorPool with funds
    await erc20Transfer(usdc, [bwr], usdcVal(1000), owner)
    await seniorPool.deposit(String(usdcVal(90)), {from: bwr})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)

    return {seniorPool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory, forwarder}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3, underwriter, reserve] = accounts
    ;({goldfinchFactory, goldfinchConfig, usdc, forwarder} = await setupTest())
  })

  describe("drawdown", async () => {
    let amount = usdcVal(10)
    beforeEach(async () => {
      bwrCon = await createBorrowerContract(bwr)
      ;({tranchedPool} = await createPoolWithCreditLine())
    })

    it("should let you drawdown the amount", async () => {
      await expectAction(() => bwrCon.drawdown(tranchedPool.address, amount, bwr, {from: bwr})).toChange([
        [async () => await getBalance(bwr, usdc), {by: amount}],
      ])
    })

    it("should not let anyone except the borrower drawdown", async () => {
      return expect(bwrCon.drawdown(tranchedPool.address, amount, person3, {from: person3})).to.be.rejectedWith(
        /Must have admin role/
      )
    })

    it("should not let anyone except the borrower drawdown via oneInch", async () => {
      return expect(
        bwrCon.drawdownWithSwapOnOneInch(tranchedPool.address, amount, person3, usdc.address, amount, [], {
          from: person3,
        })
      ).to.be.rejectedWith(/Must have admin role/)
    })

    it("should block you from drawing down on some random credit line", async () => {
      let originalBwrCon = bwrCon
      let originalBwr = bwr
      let tranchedPool2
      bwr = person3
      bwrCon = await createBorrowerContract(bwr)
      ;({tranchedPool: tranchedPool2} = await createPoolWithCreditLine())

      return expect(
        originalBwrCon.drawdown(tranchedPool2.address, amount, bwr, {from: originalBwr})
      ).to.be.rejectedWith(/Must have locker role/)
    })

    describe("address forwarding", async () => {
      it("should support forwarding the money to another address", async () => {
        await expectAction(() => bwrCon.drawdown(tranchedPool.address, amount, person3, {from: bwr})).toChange([
          [async () => await getBalance(bwrCon.address, usdc), {by: new BN(0)}],
          [async () => await getBalance(person3, usdc), {by: amount}],
        ])
      })

      context("addressToSendTo is the zero address", async () => {
        it("should default to msg.sender", async () => {
          await expectAction(() => bwrCon.drawdown(tranchedPool.address, amount, ZERO_ADDRESS, {from: bwr})).toChange([
            [async () => await getBalance(bwr, usdc), {by: amount}],
            [async () => await getBalance(bwrCon.address, usdc), {by: new BN(0)}],
          ])
        })
      })

      context("addressToSendTo is the contract address", async () => {
        it("should default to msg.sender", async () => {
          await expectAction(() => bwrCon.drawdown(tranchedPool.address, amount, bwrCon.address, {from: bwr})).toChange(
            [
              [async () => await getBalance(bwr, usdc), {by: amount}],
              [async () => await getBalance(bwrCon.address, usdc), {by: new BN(0)}],
            ]
          )
        })
      })
    })

    describe("transfering ERC20", async () => {
      it("should allow the borrower to transfer it anywhere", async () => {
        // Fund the borrower contract (in practice, this would be unexpected)
        await erc20Transfer(usdc, [bwrCon.address], usdcVal(1000), owner)

        // Send that money to the borrower!
        await expectAction(() => bwrCon.transferERC20(usdc.address, bwr, amount, {from: bwr})).toChange([
          [async () => await getBalance(bwr, usdc), {by: amount}],
        ])
      })

      it("should even allow transfers not to the borrower themselves", async () => {
        // Fund the borrower contract (in practice, this would be unexpected)
        await erc20Transfer(usdc, [bwrCon.address], usdcVal(1000), owner)

        // Send that money to the borrower!
        await expectAction(() => bwrCon.transferERC20(usdc.address, person3, amount, {from: bwr})).toChange([
          [async () => await getBalance(person3, usdc), {by: amount}],
        ])
      })

      it("should only allow admins to transfer the money", async () => {
        // Fund the borrower contract (in practice, this would be unexpected)
        await erc20Transfer(usdc, [bwrCon.address], usdcVal(1000), owner)

        // Send that money to the borrower!
        return expect(bwrCon.transferERC20(usdc.address, person3, amount, {from: person3})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("gasless transactions", async () => {
    let amount = usdcVal(1)

    const EIP712DomainType = [
      {name: "name", type: "string"},
      {name: "version", type: "string"},
      {name: "chainId", type: "uint256"},
      {name: "verifyingContract", type: "address"},
    ]

    const ForwardRequestType = [
      {name: "from", type: "address"},
      {name: "to", type: "address"},
      {name: "value", type: "uint256"},
      {name: "gas", type: "uint256"},
      {name: "nonce", type: "uint256"},
      {name: "data", type: "bytes"},
    ]

    const TypedData = {
      domain: {
        name: "Defender",
        version: "1",
        chainId: 31337,
        verifyingContract: null,
      },
      primaryType: "ForwardRequest",
      types: {
        EIP712Domain: EIP712DomainType,
        ForwardRequest: ForwardRequestType,
      },
      message: {},
    }

    beforeEach(async () => {
      TypedData.domain.verifyingContract = forwarder.address
      await goldfinchConfig.setAddressForTest(CONFIG_KEYS.TrustedForwarder, forwarder.address)
    })

    async function signAndGenerateForwardRequest(request) {
      const toSign = {...TypedData, message: request}
      // TODO: Because hardhat does not support eth_signTypedData_v4 yet, we need to use the underlying eth-sig-util library
      // to sign it for us. Remove and migrate once https://github.com/nomiclabs/hardhat/pull/1189/files is merged
      // To do that, we need to extract the private key for the borrower address and provide it in uint8[] form to the
      // sig-util library. The private key may need to be updated if the mnemonic changes or the index of the bwr account changes
      // let wallet = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk", 'm/44\'/60\'/0\'/0/1')
      // signer._signer._signTypedData()
      const bwrPrivateKey = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
      const keyAsuint8 = Uint8Array.from(Buffer.from(bwrPrivateKey, "hex"))
      const signature = signTypedData_v4(Buffer.from(keyAsuint8), {data: (toSign as unknown) as TypedMessage<any>})

      const GenericParams = "address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data"
      const TypeName = `ForwardRequest(${GenericParams})`
      const TypeHash = ethers.utils.id(TypeName)
      const DomainSeparator = bufferToHex(TypedDataUtils.hashStruct("EIP712Domain", TypedData.domain, TypedData.types))
      const SuffixData = "0x"
      return [request, DomainSeparator, TypeHash, SuffixData, signature]
    }

    async function createBorrowerAndCreditLine() {
      bwrCon = await createBorrowerContract(bwr)
      ;({tranchedPool} = await createPoolWithCreditLine())
    }

    describe("When the forwarder is not trusted", async () => {
      it("does not use the passed in msg sender", async () => {
        await goldfinchConfig.setAddressForTest(CONFIG_KEYS.TrustedForwarder, reserve)
        await createBorrowerAndCreditLine()
        const request = {
          from: bwr,
          to: bwrCon.address,
          value: 0,
          gas: 1e6,
          nonce: 0,
          data: bwrCon.contract.methods.drawdown(tranchedPool.address, amount.toNumber(), bwr).encodeABI(),
        }
        let forwarderArgs = await signAndGenerateForwardRequest(request)
        // Signature is still valid
        await forwarder.verify(...forwarderArgs)
        await expect(forwarder.execute(...forwarderArgs, {from: person3})).to.be.rejectedWith(/Must have admin role/)
      })
    })

    describe("when the forwarder is trusted", async () => {
      it("uses the passed in msg sender", async () => {
        await createBorrowerAndCreditLine()
        const request = {
          from: bwr,
          to: bwrCon.address,
          value: 0,
          gas: 1e6,
          nonce: 0,
          data: bwrCon.contract.methods.drawdown(tranchedPool.address, amount.toNumber(), bwr).encodeABI(),
        }
        let forwarderArgs = await signAndGenerateForwardRequest(request)
        await forwarder.verify(...forwarderArgs)
        await expectAction(() => forwarder.execute(...forwarderArgs, {from: person3})).toChange([
          [() => getBalance(tranchedPool.address, usdc), {by: amount.neg()}],
          [() => getBalance(bwr, usdc), {by: amount}],
        ])
      })

      it("only allows using the same nonce once", async () => {
        await createBorrowerAndCreditLine()
        const request = {
          from: bwr,
          to: bwrCon.address,
          value: 0,
          gas: 1e6,
          nonce: 0,
          data: bwrCon.contract.methods.drawdown(tranchedPool.address, amount.toNumber(), bwr).encodeABI(),
        }
        let forwarderArgs = await signAndGenerateForwardRequest(request)
        await forwarder.verify(...forwarderArgs)
        await forwarder.execute(...forwarderArgs, {from: person3})
        await expect(forwarder.verify(...forwarderArgs)).to.be.rejectedWith(/nonce mismatch/)
        await expect(forwarder.execute(...forwarderArgs, {from: person3})).to.be.rejectedWith(/nonce mismatch/)
      })

      describe("when addressToSendTo is the zero address", async () => {
        it("uses the passed in msg sender", async () => {
          await createBorrowerAndCreditLine()
          const request = {
            from: bwr,
            to: bwrCon.address,
            value: 0,
            gas: 1e6,
            nonce: 0,
            data: bwrCon.contract.methods.drawdown(tranchedPool.address, amount.toNumber(), ZERO_ADDRESS).encodeABI(),
          }
          let forwarderArgs = await signAndGenerateForwardRequest(request)
          await forwarder.verify(...forwarderArgs)
          await expectAction(() => forwarder.execute(...forwarderArgs, {from: person3})).toChange([
            [() => getBalance(tranchedPool.address, usdc), {by: amount.neg()}],
            [() => getBalance(bwr, usdc), {by: amount}],
          ])
        })
      })

      describe("when addressToSendTo is the borrower contract address", async () => {
        it("uses the passed in msg sender", async () => {
          await createBorrowerAndCreditLine()
          const request = {
            from: bwr,
            to: bwrCon.address,
            value: 0,
            gas: 1e6,
            nonce: 0,
            data: bwrCon.contract.methods.drawdown(tranchedPool.address, amount.toNumber(), bwrCon.address).encodeABI(),
          }
          let forwarderArgs = await signAndGenerateForwardRequest(request)
          await forwarder.verify(...forwarderArgs)
          await expectAction(() => forwarder.execute(...forwarderArgs, {from: person3})).toChange([
            [() => getBalance(tranchedPool.address, usdc), {by: amount.neg()}],
            [() => getBalance(bwr, usdc), {by: amount}],
          ])
        })
      })
    })
  })

  describe("pay", async () => {
    let bwrCon, cl
    let amount = usdcVal(10)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      ;({tranchedPool, creditLine: cl} = await createPoolWithCreditLine(bwrCon))
      await bwrCon.drawdown(tranchedPool.address, amount, bwr, {from: bwr})
    })

    it("should payback the loan as expected", async () => {
      await expectAction(() => bwrCon.pay(tranchedPool.address, amount, {from: bwr})).toChange([
        [async () => await getBalance(cl.address, usdc), {increase: true}],
        [async () => await getBalance(bwr, usdc), {by: amount.neg()}],
      ])

      await advanceTime(tranchedPool, {toSecond: (await cl.nextDueTime()).add(new BN(1))})

      await expectAction(() => tranchedPool.assess()).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {by: amount.neg()}],
        [async () => await getBalance(tranchedPool.address, usdc), {increase: true}],
      ])
    })
  })

  describe("payMultiple", async () => {
    let tranchedPool2, cl2
    let amount = usdcVal(10)
    let amount2 = usdcVal(5)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      ;({tranchedPool, creditLine: cl} = await createPoolWithCreditLine())
      ;({tranchedPool: tranchedPool2, creditLine: cl2} = await createPoolWithCreditLine())

      expect(tranchedPool.address).to.not.eq(tranchedPool2.addresss)

      await bwrCon.drawdown(tranchedPool.address, amount, bwr, {from: bwr})
      await bwrCon.drawdown(tranchedPool2.address, amount2, bwr, {from: bwr})
    })

    it("should payback the loan as expected", async () => {
      await expectAction(() =>
        bwrCon.payMultiple([tranchedPool.address, tranchedPool2.address], [amount, amount2], {from: bwr})
      ).toChange([
        [() => getBalance(cl.address, usdc), {by: amount}],
        [() => getBalance(cl2.address, usdc), {by: amount2}],
        [() => getBalance(bwr, usdc), {by: amount.add(amount2).neg()}],
      ])

      await advanceTime(tranchedPool, {toSecond: (await cl.nextDueTime()).add(new BN(100))})
      await advanceTime(tranchedPool2, {toSecond: (await cl2.nextDueTime()).add(new BN(100))})

      await expectAction(() => tranchedPool.assess()).toChange([
        [() => cl.balance(), {decrease: true}],
        [() => getBalance(tranchedPool.address, usdc), {increase: true}],
      ])
      await expectAction(() => tranchedPool2.assess()).toChange([
        [() => cl2.balance(), {decrease: true}],
        [() => getBalance(tranchedPool2.address, usdc), {increase: true}],
      ])
    })
  })

  describe("payInFull", async () => {
    let amount = usdcVal(10)
    beforeEach(async () => {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(usdc, bwrCon.address, usdcVal(100000), [bwr])
      ;({tranchedPool, creditLine: cl} = await createPoolWithCreditLine())
      await bwrCon.drawdown(tranchedPool.address, amount, bwr, {from: bwr})
    })

    it("should fully pay back the loan", async () => {
      await advanceTime(tranchedPool, {toSecond: (await cl.nextDueTime()).add(new BN(1))})
      await expectAction(async () => bwrCon.payInFull(tranchedPool.address, usdcVal(11), {from: bwr})).toChange([
        [async () => cl.balance(), {to: new BN(0)}],
        [async () => getBalance(tranchedPool.address, usdc), {increase: true}],
      ])
    })

    it("fails if the loan is not fully paid off", async () => {
      await expect(bwrCon.payInFull(tranchedPool.address, usdcVal(5), {from: bwr})).to.be.rejectedWith(
        /Failed to fully pay off creditline/
      )
      expect(await cl.balance()).to.bignumber.gt(new BN(0))
    })
  })
})
