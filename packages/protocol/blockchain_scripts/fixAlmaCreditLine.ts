import hre, {getChainId, getNamedAccounts} from "hardhat"
import {
  assertIsChainId,
  ContractDeployer,
  getContract,
  getProtocolOwner,
  isMainnetForking,
  MAINNET_CHAIN_ID,
  OWNER_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "./deployHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {CreditLineInstance, GoldfinchFactoryInstance, TranchedPoolInstance} from "../typechain/truffle"
import {fundWithWhales, getExistingContracts, impersonateAccount, upgradeContracts} from "./mainnetForkingHelpers"
import {decodeLogs} from "../test/testHelpers"
import {CreditLineCreated} from "../typechain/truffle/CreditDesk"
import {asNonNullable} from "@goldfinch-eng/utils"
import {CreditLine, GoldfinchFactory, TranchedPool} from "../typechain/ethers"

async function main() {
  // let oldBorrowerAddress = "0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6"
  // let oldCreditLineAddress = "0x306e330d084f7996f41bb113b5f0f15501c821a5"
  // let pool = await getContract("Pool")
  // let config = await getContract("GoldfinchConfig", {at: "0x7daa6477194b784d384e79333230daec3b32a65e"})

  // let data = await getMigrationData(oldCreditLineAddress, pool)
  // console.log(data)
  // assertNonNullable(data)
  //
  // -- output (ran with block 13050787) --
  // {
  //   termEndTime: 1725498350,
  //   termStartTime: 1622163950,
  //   nextDueTime: 1632531950,
  //   interestAccruedAsOf: 1629939950,
  //   lastFullPaymentTime: 1626810333,
  //   totalInterestPaid: <BN: 2deda0e43>,
  //   totalPrincipalPaid: <BN: 329d>
  // }

  const contractsToUpgrade = ["GoldfinchFactory"]
  const {gf_deployer} = await getNamedAccounts()
  assertNonNullable(gf_deployer)
  const owner = await getProtocolOwner()
  await impersonateAccount(hre, owner)
  await fundWithWhales(["ETH"], [owner])
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  assertIsChainId(chainId)
  const deployer = new ContractDeployer(console.log, hre)
  const existingContracts = await getExistingContracts(contractsToUpgrade, owner, chainId)
  const upgradedContracts = await upgradeContracts(contractsToUpgrade, existingContracts, owner, gf_deployer, deployer)

  const goldfinchFactoryAddress = asNonNullable(upgradedContracts.GoldfinchFactory).ProxyContract.address
  const goldfinchFactory = await getContract<GoldfinchFactory, GoldfinchFactoryInstance>(
    "GoldfinchFactory",
    TRUFFLE_CONTRACT_PROVIDER,
    {
      at: goldfinchFactoryAddress,
    }
  )

  const tx = await goldfinchFactory.createCreditLine()
  const events = decodeLogs<CreditLineCreated>(tx.receipt.rawLogs, goldfinchFactory, "CreditLineCreated")
  const creditLineAddress = asNonNullable(events[0]).args.creditLine
  const creditLine = await getContract<CreditLine, CreditLineInstance>("CreditLine", TRUFFLE_CONTRACT_PROVIDER, {
    at: creditLineAddress,
  })

  const tranchedPool = await getContract<TranchedPool, TranchedPoolInstance>(
    "TranchedPool",
    TRUFFLE_CONTRACT_PROVIDER,
    {
      at: "0x67df471EaCD82c3dbc95604618FF2a1f6b14b8a1",
    }
  )
  const currentCreditLine = await getContract<CreditLine, CreditLineInstance>("CreditLine", TRUFFLE_CONTRACT_PROVIDER, {
    at: await tranchedPool.creditLine(),
  })

  console.log("---- Run as gnosis multisend ----")

  const configAddr = await currentCreditLine.config()
  const borrower = await currentCreditLine.borrower()
  const limit = await currentCreditLine.limit()
  const interestApr = await currentCreditLine.interestApr()
  const paymentPeriodInDays = await currentCreditLine.paymentPeriodInDays()
  const termInDays = "1196"
  const lateFeeApr = await currentCreditLine.lateFeeApr()
  await creditLine.initialize(
    configAddr,
    owner,
    borrower,
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    {from: owner}
  )

  console.log("CreditLine.initialize(")
  console.log("  config", configAddr)
  console.log("  owner", owner)
  console.log("  borrower", borrower)
  console.log("  limit", limit.toString())
  console.log("  interestApr", interestApr.toString())
  console.log("  paymentPeriodInDays", paymentPeriodInDays.toString())
  console.log("  termInDays", termInDays.toString())
  console.log("  lateFeeApr", lateFeeApr.toString())
  console.log(")")

  const balance = await currentCreditLine.balance()
  await creditLine.setBalance(balance, {from: owner})
  console.log("CreditLine.setBalance(")
  console.log("  balance", balance.toString())
  console.log(")")

  // From spreadsheet
  const interestOwed = 240277e4
  await creditLine.setInterestOwed(interestOwed, {from: owner})
  console.log("CreditLine.setInterestOwed(")
  console.log("  interestOwed", interestOwed.toString())
  console.log(")")

  const principalOwed = await currentCreditLine.principalOwed()
  await creditLine.setPrincipalOwed(principalOwed, {from: owner})
  console.log("CreditLine.setPrincipalOwed(")
  console.log("  principalOwed", principalOwed.toString())
  console.log(")")

  // From corrected migration params
  const termEndTime = "1725498350"
  await creditLine.setTermEndTime(termEndTime, {from: owner})
  console.log("CreditLine.setTermEndTime(")
  console.log("  termEndTime", termEndTime.toString())
  console.log(")")

  // From corrected migration params
  const nextDueTime = "1632531950"
  await creditLine.setNextDueTime(nextDueTime, {from: owner})
  console.log("CreditLine.setNextDueTime(")
  console.log("  nextDueTime", nextDueTime.toString())
  console.log(")")

  // From corrected migration params
  const interestAccruedAsOf = "1629939950"
  await creditLine.setInterestAccruedAsOf(interestAccruedAsOf, {from: owner})
  console.log("CreditLine.setInterestAccruedAsOf(")
  console.log("  interestAccruedAsOf", interestAccruedAsOf.toString())
  console.log(")")

  const lastFullPaymentTime = await currentCreditLine.lastFullPaymentTime()
  await creditLine.setLastFullPaymentTime(lastFullPaymentTime, {from: owner})
  console.log("CreditLine.setLastFullPaymentTime(")
  console.log("  lastFullPaymentTime", lastFullPaymentTime.toString())
  console.log(")")

  // From spreadsheet
  const totalInterestAccrued = 2225959e4
  await creditLine.setTotalInterestAccrued(totalInterestAccrued, {from: owner})
  console.log("CreditLine.setTotalInterestAccrued(")
  console.log("  totalInterestAccrued", totalInterestAccrued.toString())
  console.log(")")

  await creditLine.grantRole(OWNER_ROLE, tranchedPool.address, {from: owner})
  console.log("CreditLine.grantRole(")
  console.log("  role", OWNER_ROLE.toString())
  console.log("  address", tranchedPool.address.toString())
  console.log(")")

  await tranchedPool.migrateAndSetNewCreditLine(creditLine.address, {from: owner})
  console.log("TranchedPool.migrateAndSetNewCreditLine(")
  console.log("  creditLine", "<get from creation transaction>")
  console.log(")")

  console.log("---- end gnosis multisend ----")

  console.log("balance", (await creditLine.balance()).toString())
  console.log("interestOwed", (await creditLine.interestOwed()).toString())
  await tranchedPool.assess()
  console.log("interestOwed after assess", (await creditLine.interestOwed()).toString())
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
