import {BigNumber, ethers} from "ethers"
import {Relayer} from "defender-relay-client"
import {DefenderRelaySigner, DefenderRelayProvider} from "defender-relay-client/lib/ethers"
import axios from "axios"
import {asNonNullable, INVALID_POOLS} from "@goldfinch-eng/utils"
import baseHandler from "../core/handler"
import {CreditLine, ERC20, PoolTokens, SeniorPool, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"

const CONFIG = {
  mainnet: {
    factoryAddress: "0xd20508E1E971b80EE172c73517905bfFfcBD87f9",
    poolTokensAddress: "0x57686612C601Cb5213b01AA8e80AfEb24BBd01df",
    seniorPoolAddress: "0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822",
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    etherscanApi: "https://api.etherscan.io/api",
  },
} as const

const PROXY_IMPLEMENTATION_SLOTS = {
  // USDC uses a very old proxy implementation
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/release/2.0/packages/lib/contracts/upgradeability/UpgradeabilityProxy.sol
  [CONFIG.mainnet.usdcAddress]: "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
  // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
  default: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
}

// Entrypoint for the Autotask
exports.handler = baseHandler("assessor", async function (credentials) {
  const {etherscanApiKey} = credentials.secrets
  const relayer = new Relayer(credentials)
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})

  const relayerInfo = await relayer.getRelayer()
  console.log(`Assessing using ${relayerInfo.name} on ${relayerInfo.network} `)

  const config: typeof CONFIG.mainnet = CONFIG[relayerInfo.network]
  if (!config) {
    throw new Error(`Unsupported network: ${relayerInfo.network}`)
  }

  const goldfinchFactoryAddress = config.factoryAddress

  const factoryAbi = await getAbifor(config.etherscanApi, goldfinchFactoryAddress, provider, etherscanApiKey)
  const factory = new ethers.Contract(goldfinchFactoryAddress, factoryAbi, signer)
  const poolTokensAbi = await getAbifor(config.etherscanApi, config.poolTokensAddress, provider, etherscanApiKey)
  const poolTokens = new ethers.Contract(config.poolTokensAddress, poolTokensAbi, signer) as PoolTokens
  const seniorPoolAbi = await getAbifor(config.etherscanApi, config.seniorPoolAddress, provider, etherscanApiKey)
  const seniorPool = new ethers.Contract(config.seniorPoolAddress, seniorPoolAbi, signer) as SeniorPool
  const usdcAbi = await getAbifor(config.etherscanApi, config.usdcAddress, provider, etherscanApiKey)
  const usdc = new ethers.Contract(config.usdcAddress, usdcAbi, signer) as ERC20

  const filter = asNonNullable(factory.filters.PoolCreated)
  const result = await factory.queryFilter(filter(null, null))

  let pools: string[] = []
  for (const poolCreated of result) {
    const poolAddress = asNonNullable(poolCreated.args?.pool)

    if (INVALID_POOLS.has(poolAddress.toLowerCase())) {
      console.log(`On denylist, skipping assessment of ${poolAddress}`)
      continue
    }

    pools = pools.concat(poolAddress)
  }

  if (pools.length === 0 || pools[0] == undefined) {
    console.log("No pools to assess")
    return
  }

  const poolAbi = await getAbifor(config.etherscanApi, pools[0], provider, etherscanApiKey)
  const pool = new ethers.Contract(asNonNullable(pools[0]), poolAbi, signer) as TranchedPool

  const creditLineAddress = await pool.creditLine()
  const creditLineAbi = await getAbifor(config.etherscanApi, creditLineAddress, provider, etherscanApiKey)
  const creditLine = new ethers.Contract(creditLineAddress, creditLineAbi, signer) as CreditLine

  console.log(`Found ${pools.length} tranched pools`)
  let success = 0
  for (const poolAddress of pools) {
    try {
      console.log(`Assessing ${poolAddress}`)
      await assessIfRequired(pool.attach(poolAddress), creditLine, provider, seniorPool, poolTokens, usdc)
      success += 1
    } catch (err) {
      console.log(`Error trying to assess creditline: ${err}`)
    }
  }

  console.log(`Successfully assessed ${success} of ${pools.length} pools`)

  if (success !== pools.length && relayerInfo.network === "mainnet") {
    throw new Error(`${pools.length - success} pools failed to asses`)
  }
})

const assessIfRequired = async function assessIfRequired(
  tranchedPool: TranchedPool,
  creditLineContract: CreditLine,
  provider: DefenderRelayProvider,
  seniorPool: SeniorPool,
  poolTokens: PoolTokens,
  usdc: ERC20
): Promise<boolean> {
  const creditLineAddress = await tranchedPool.creditLine()
  const creditLine = creditLineContract.attach(creditLineAddress)
  const currentTime = BigNumber.from((await provider.getBlock("latest")).timestamp)
  const nextDueTime = await creditLine.nextDueTime()
  const termEndTime = await creditLine.termEndTime()
  const balance = await creditLine.balance()
  const usdcBalance = await usdc.balanceOf(creditLineAddress)
  const limit = await creditLine.limit()

  if (limit.isZero()) {
    console.log(`Assess ${creditLine.address}: Skipped (Closed)`)
    return false
  }

  if (nextDueTime.isZero()) {
    if (!balance.isZero()) {
      throw new Error(`Non-zero balance (${balance}) for pool ${tranchedPool.address} without a nextDueTime`)
    }
    console.log(`Assess ${tranchedPool.address}: Skipped (Zero balance)`)
    return false
  }

  if (currentTime.gte(termEndTime)) {
    // Currently we don't have a good way to track the last time we assessed a creditLine past it's
    // term end block. So we're going to keep assessing it everytime the script runs for now.

    console.log(`Assessing pool beyond the end time: ${tranchedPool.address}`)
    await assessAndRedeem(tranchedPool, seniorPool, poolTokens)
    return true
  }

  if (currentTime.gte(nextDueTime)) {
    // CreditLine is past the due time, assess in case there's anything waiting to be allocated.

    console.log(`Assessing ${tranchedPool.address} (past next due time)`)
    await assessAndRedeem(tranchedPool, seniorPool, poolTokens)
    return true
  }

  if (await isLate(creditLine, balance, currentTime)) {
    // CreditLine might have been paid on time, but only partially. Check if it's late on payments
    // and assess if there's USDC waiting for assessment.

    if (usdcBalance.isZero()) {
      // Skip assessing if usdc balance is zero because assessing will have no impact and just burn gas
      console.log(`Skipped assessing late pool as there's no pending USDC: ${tranchedPool.address}`)
      return false
    }

    console.log(`Assessing ${tranchedPool.address} (late on payment)`)
    await assessAndRedeem(tranchedPool, seniorPool, poolTokens)
    return true
  }

  // At this point, the credit line
  // 1. Is not closed
  // 2. Is not new
  // 3. Is not past its end time
  // 4. Is not past its due time
  // 5. Is not late
  // So there's no reason to assess

  const nextDueTimeFormatted = new Date(nextDueTime.toNumber() * 1000).toISOString()
  console.log(`Assess ${tranchedPool.address}: Skipped (Already assessed). Next Due: ${nextDueTimeFormatted}`)
  return false
}

async function isLate(creditLine: CreditLine, balance: BigNumber, timestamp: BigNumber) {
  try {
    return await creditLine.isLate()
  } catch {
    // Not all CredtLines have a public isLate. For those, calculate isLate using the
    // same logic they declare internally.

    const SECONDS_PER_DAY = BigNumber.from(24 * 60 * 60)
    const [lastFullPaymentTime, paymentPeriodInDays] = await Promise.all([
      creditLine.lastFullPaymentTime(),
      creditLine.paymentPeriodInDays(),
    ])
    const secondsElapsedSinceFullPayment = timestamp.sub(lastFullPaymentTime)
    return !balance.isZero() && secondsElapsedSinceFullPayment.gt(paymentPeriodInDays.mul(SECONDS_PER_DAY))
  }
}

async function assessAndRedeem(tranchedPool: TranchedPool, seniorPool: SeniorPool, poolTokens: PoolTokens) {
  await tranchedPool.assess()

  // Now get the tokenId for the senior pool so we can redeem (or writedown if required)
  const result = await poolTokens.queryFilter(poolTokens.filters.TokenMinted(seniorPool.address, tranchedPool.address))

  for (const tokenMinted of result) {
    const tokenId = tokenMinted.args.tokenId
    console.log(`Redeeming token ${tokenId} from pool ${tranchedPool.address}`)
    // TODO: Uncomment once we have a "redeemer" role that can redeem/writedown
    // await seniorPool.redeem(tokenId)

    const writedownAmount = await seniorPool.calculateWritedown(tokenId)

    if (!writedownAmount.isZero()) {
      console.log(`Writedown for token ${tokenId} from pool ${tranchedPool.address}: ${writedownAmount.toString()}`)
      // TODO: Uncomment once we have a "redeemer" role that can redeem/writedown
      // await seniorPool.writedown(tokenId)
    }
  }
}

async function getAbifor(
  etherscanApiUrl: string,
  address: string,
  provider: DefenderRelayProvider,
  etherscanApiKey: string
) {
  const implStorageLocation = PROXY_IMPLEMENTATION_SLOTS[address] || PROXY_IMPLEMENTATION_SLOTS.default
  let implementationAddress = await provider.getStorageAt(address, implStorageLocation)
  implementationAddress = ethers.utils.hexStripZeros(implementationAddress)
  if (implementationAddress !== "0x") {
    address = implementationAddress
  }

  // https://etherscan.io/apis#contracts
  const url = `${etherscanApiUrl}?module=contract&action=getabi&address=${address}&apikey=${etherscanApiKey}`
  const body = await axios.get(url)
  const bodyAsJson = body.data

  if (bodyAsJson.message !== "OK") {
    throw new Error(`Error fetching ABI for ${address}: ${bodyAsJson.result}`)
  }
  return JSON.parse(bodyAsJson.result)
}

// For tests
export {assessIfRequired}

// To run locally (this code will not be executed in Autotasks)
// Invoke with: API_KEY=<key> API_SECRET=<secret> node autotasks/assessor/dist/index.js
if (require.main === module) {
  const {API_KEY: apiKey, API_SECRET: apiSecret} = process.env
  exports
    .handler({apiKey, apiSecret})
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
