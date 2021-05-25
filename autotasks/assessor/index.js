const {ethers} = require("ethers")
const {Relayer} = require("defender-relay-client")
const {DefenderRelaySigner, DefenderRelayProvider} = require("defender-relay-client/lib/ethers")
const fetch = require("node-fetch")

const CONFIG = {
  mainnet: {
    address: "0xD52dc1615c843c30F2e4668E101c0938e6007220",
    underwriters: ["0xc840b3e21ff0eba77468ad450d868d4362cf67fe", "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"],
    etherscanApi: "https://api.etherscan.io/api",
  },
  rinkeby: {
    address: "0x8b84E427B9732f03a9EF4195F94737b3fE6f3FA7",
    underwriters: ["0x83CB0ec2f0013a9641654b344D34615f95b7D7FC"],
    etherscanApi: "https://api-rinkeby.etherscan.io/api",
  },
}

const ETHERSCAN_API_KEY = "DQUC8Y678J5RN5P7XE9RT91SWI7SSEDD53"

// Entrypoint for the Autotask
exports.handler = async function (credentials) {
  const relayer = new Relayer(credentials)
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})

  const relayerInfo = await relayer.getRelayer()
  console.log(`Assessing using ${relayerInfo.name} on ${relayerInfo.network} `)

  let config = CONFIG[relayerInfo.network]
  if (!config) {
    throw new Error(`Unsupported network: ${relayerInfo.network}`)
  }

  const creditDeskAddress = config.address

  let creditLines = []

  const creditDeskAbi = await getAbifor(config.etherscanApi, creditDeskAddress, provider)
  const creditDesk = new ethers.Contract(creditDeskAddress, creditDeskAbi, signer)

  for (const underwriter of config.underwriters) {
    creditLines = creditLines.concat(await creditDesk.getUnderwriterCreditLines(underwriter))
  }

  if (creditLines.length === 0) {
    console.log("No credit lines to assess")
    return
  }

  const creditLineAbi = await getAbifor(config.etherscanApi, creditLines[0], provider)
  const creditLine = new ethers.Contract(creditLines[0], creditLineAbi, signer)

  console.log(`Found ${creditLines.length} creditlines for ${config.underwriters.length} underwriters`)
  let success = 0
  for (const creditLineAddress of creditLines) {
    try {
      console.log(`Assessing ${creditLineAddress}`)
      await assessIfRequired(creditDesk, creditLine.attach(creditLineAddress), provider)
      success += 1
    } catch (err) {
      console.log(`Error trying to assess creditline: ${err}`)
    }
  }

  console.log(`Successfully assessed ${success} of ${creditLines.length} creditlines`)

  if (success !== creditLines.length && relayerInfo.network === "mainnet") {
    throw new Error(`${creditLines.length - success} creditlines failed to asses`)
  }
}

const assessIfRequired = async function assessIfRequired(tranchedPool, creditLine, provider) {
  // Normalize everything to ethers.BigNumber because tests use Truffle and therefore bn.js
  // which is incompatible with BigNumber
  const currentTime = ethers.BigNumber.from((await provider.getBlock("latest")).timestamp.toString())
  const nextDueTime = ethers.BigNumber.from((await creditLine.nextDueTime()).toString())
  const termEndTime = ethers.BigNumber.from((await creditLine.termEndTime()).toString())

  if (nextDueTime.isZero()) {
    const balance = await creditLine.balance()
    if (!balance.isZero()) {
      throw new Error(`Non-zero balance (${balance}) for creditLine ${creditLine.address} without a nextDueTime`)
    }
    console.log(`Assess ${creditLine.address}: Skipped (Zero balance)`)
  } else {
    if (currentTime.gte(termEndTime)) {
      // Currently we don't have a good way to track the last time we assessed a creditLine past it's
      // term end block. So we're going to keep assessing it everytime the script runs for now.
      await tranchedPool.assess()
    } else if (currentTime.gte(nextDueTime)) {
      await tranchedPool.assess()
    } else {
      console.log(`Assess ${creditLine.address}: Skipped (Already assessed)`)
    }
  }
}

async function getAbifor(etherscanApiUrl, address, provider) {
  // Deference the proxy to the implementation if it is a proxy
  // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.2.0/contracts/proxy/TransparentUpgradeableProxy.sol#L81
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let implementationAddress = await provider.getStorageAt(address, implStorageLocation)
  implementationAddress = ethers.utils.hexStripZeros(implementationAddress)
  if (implementationAddress !== "0x") {
    address = implementationAddress
  }

  // https://etherscan.io/apis#contracts
  const url = `${etherscanApiUrl}?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_API_KEY}`
  const body = await fetch(url)
  const bodyAsJson = await body.json()

  if (bodyAsJson.message !== "OK") {
    throw new Error(`Error fetching ABI for ${address}: ${bodyAsJson.result}`)
  }
  return JSON.parse(bodyAsJson.result)
}

// For tests
exports.assessIfRequired = assessIfRequired

// To run locally (this code will not be executed in Autotasks)
// Invoke with: API_KEY=<key> API_SECRET=<secret> node autotasks/assessor/index.js
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
