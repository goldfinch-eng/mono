import fetch from "node-fetch"
import {AssertionError, assertNonNullable, findEnvLocal} from "@goldfinch-eng/utils"
import hre, {ethers} from "hardhat"
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import {PoolTokens, UniqueIdentity} from "../../typechain/ethers"
import {assertIsChainId, getDeployedContract} from "../deployHelpers"
import {SIGNATURE_EXPIRY_IN_SECONDS} from "./constants"
import {DefenderRelayProvider, DefenderRelaySigner} from "defender-relay-client/lib/ethers"
import {fetchAccount, updateReferenceId} from "../personaGolist"
import dotenv from "dotenv"
import {BigNumber} from "ethers/lib/ethers"
dotenv.config({path: findEnvLocal()})

async function logPoolTokens(poolTokens: PoolTokens, address: string) {
  console.log("Logging pool tokens...")

  const numPoolTokens = await poolTokens.balanceOf(address)

  console.log(`${address} owns ${numPoolTokens} poolTokens`)

  const poolTokenRequests: Promise<BigNumber>[] = []
  for (let i = 0; i < numPoolTokens.toNumber(); ++i) {
    poolTokenRequests.push(poolTokens.tokenOfOwnerByIndex(address, i))
  }
  const poolTokensForAccount = await Promise.all(poolTokenRequests)

  poolTokensForAccount.forEach((token) => {
    console.log(`poolTokenId: ${token.toString()}`)
  })
}

async function burnUID(burnAccount: string, burnIdType: string, signer: DefenderRelaySigner, burnerPrivateKey: string) {
  const {deployments} = hre
  const currentBlock = await ethers.provider.getBlock("latest")
  const uniqueIdentity = await getDeployedContract<UniqueIdentity>(deployments, "UniqueIdentity")
  const poolTokens = await getDeployedContract<PoolTokens>(deployments, "PoolTokens")
  const expiresAt = currentBlock.timestamp + SIGNATURE_EXPIRY_IN_SECONDS

  const nonce = await uniqueIdentity.nonces(burnAccount, {blockTag: currentBlock.number})
  if (!nonce.gt(0)) {
    // We expect the nonce to be greater than zero, because for there to be a token that can
    // be burned, there must have been a prior mint which would have incremented the nonce.
    throw new Error("Expected account to have non-zero nonce.")
  }

  const existingBalance = await uniqueIdentity.balanceOf(burnAccount, burnIdType, {blockTag: currentBlock.number})
  if (existingBalance.eq(0)) {
    // Log this no-op rather than throw an error, so that the script can be re-run successfully in
    // case the logic after the burn call were to fail and we wanted to retry that logic.
    console.log(`Account ${burnAccount} has no UID of type ${burnIdType} to burn.`)
  } else {
    // Log any PoolToken balances owned by BURN_ACCOUNT. The user will be unable to
    // use their pool tokens without a valid UID. In the case where they remint the UID
    // token with a new address PREPARE_REMINT_ACCOUNT, pool tokens owned by BURN_ACCOUNT
    // would have to be transferred to PREPARE_REMINT_ACCOUNT to perform a TranchedPool
    // withdrawal
    logPoolTokens(poolTokens, burnAccount)

    const chainId = await hre.getChainId()
    assertIsChainId(chainId)

    const signTypes = ["address", "uint256", "uint256", "address", "uint256", "uint256"]
    const signParams = [burnAccount, burnIdType, expiresAt, uniqueIdentity.address, nonce, chainId]
    const encoded = pack(signTypes, signParams)
    const hashed = keccak256(encoded)
    const signature = await signer.signMessage(ethers.utils.arrayify(hashed))

    const burner = new ethers.Wallet(burnerPrivateKey, ethers.provider)

    console.log(
      `burn params burnAccount=${burnAccount}, burnIdType=${burnIdType}, expiresAt=${expiresAt}, signature=${signature}`
    )
    const burnTx = await uniqueIdentity.connect(burner).burn(burnAccount, burnIdType, expiresAt, signature)

    console.log("submitted burn!")
    console.log("raw transaction:")
    console.log(burnTx)
  }
}

async function destroyUser(
  addressToDestroy: string,
  burnedUidType: number,
  network: string,
  signer: DefenderRelaySigner,
  provider: DefenderRelayProvider
) {
  const cloudFunctionsBaseUrl =
    network === "mainnet"
      ? "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net"
      : "http://localhost:5001/goldfinch-frontends-dev/us-central1"
  const destroyUserUrl = `${cloudFunctionsBaseUrl}/destroyUser`
  const signerAddress = await signer.getAddress()

  let blockNum: number
  if (network === "localhost") {
    const blockNumberRawResponse = (await hre.network.provider.request({method: "eth_blockNumber"})) as string
    // Response is a hex string so must convert to base 10
    blockNum = hre.ethers.BigNumber.from(blockNumberRawResponse).toNumber()
  } else {
    blockNum = await provider.getBlockNumber()
  }

  const message = ethers.utils.defaultAbiCoder.encode(["address", "uint8"], [addressToDestroy, burnedUidType])
  console.log(`Signing message "${message}"`)
  const signature = await signer.signMessage(message)

  const headers = {
    "x-goldfinch-address": signerAddress,
    "x-goldfinch-signature": signature,
    "x-goldfinch-signature-plaintext": message,
    "x-goldfinch-signature-block-num": `${blockNum}`,
    "content-type": "application/json",
  }

  console.log(`POSTing to ${destroyUserUrl}`)
  console.log(headers)
  await fetch(destroyUserUrl, {
    method: "POST",
    headers,
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.error) {
        throw res
      }
      console.log("destroyUser response")
      console.log(res)
    })
}

function getEnvVars() {
  const network = process.env.BURN_UID_NETWORK
  assertNonNullable(network, "BURN_UID_NETWORK undefined")
  if (!(network === "mainnet" || network === "localhost")) {
    throw new AssertionError(`Expected 'mainnet' or 'localhost' for NETWORK environment var but got ${network}`)
  }
  console.log(`network: ${network}`)

  // The account whose UID to burn.
  const burnAccount = process.env.BURN_ACCOUNT
  assertNonNullable(burnAccount, "BURN_ACCOUNT undefined")
  console.log(`burn account: ${burnAccount}`)

  // The id type of the UID to burn belonging to `burnAccount`.
  const burnUidType = process.env.BURN_UID_TYPE
  assertNonNullable(burnUidType, "BURN_UID_TYPE undefined")
  console.log(`burnIdType: ${burnUidType}`)

  // This is a relayer with the SIGNER_ROLE on the mainnet UniqueIdentity contract
  // Its signature will allow us to call `burn`. Its address is also whitelisted on
  // the /destroyUser cloud function
  const credentials = {
    apiKey: process.env.UNIQUE_IDENTITY_SIGNER_API_KEY as string,
    apiSecret: process.env.UNIQUE_IDENTITY_SIGNER_API_SECRET as string,
  }
  assertNonNullable(credentials.apiKey, "UNIQUE_IDENTITY_SIGNER_API_KEY undefined")
  assertNonNullable(credentials.apiSecret, "UNIQUE_IDENTITY_SIGNER_API_SECRET undefined")

  const prepareRemintAccount = process.env.PREPARE_REMINT_ACCOUNT

  const personaApiKey = process.env.PERSONA_API_KEY
  assertNonNullable(personaApiKey, "PERSONA_API_KEY undefined")

  const burnerPrivateKey = process.env.BURNER_PRIVATE_KEY
  assertNonNullable(burnerPrivateKey, "BURNER_PRIVATE_KEY undefined")

  return {network, burnAccount, burnUidType, credentials, burnerPrivateKey, prepareRemintAccount, personaApiKey}
}

/**
 * burnUID script. NOTE: This script works for UID's minted with Persona KYC. It currently doesn't support burning
 * UID's minted with Parallel Markets.
 */
async function main(): Promise<void> {
  const network = hre.network.name
  const {burnAccount, burnUidType, credentials, burnerPrivateKey, prepareRemintAccount} = getEnvVars()

  console.log("Running burnUID script...")
  console.log(`network: ${network}`)
  console.log(`burnAccount: ${burnAccount}`)
  console.log(`burnUidType: ${burnUidType}`)
  console.log(`defender api key: ${credentials.apiKey}`)
  console.log(`prepareRemintAccount: ${prepareRemintAccount}`)

  console.log(`Fetching persona account for ${burnAccount}`)
  const personaAccount = await fetchAccount(burnAccount)
  if (!personaAccount) {
    throw new Error(`Could not find persona account for address to burn ${burnAccount}`)
  }
  console.log(personaAccount)

  // Validate the remint account doesn't already exist on Persona. This should be remedied before
  // running the script again
  if (prepareRemintAccount) {
    console.log(`Checking if persona acct already exists for prepareRemintAccount: ${prepareRemintAccount}`)
    let remintAccount
    try {
      remintAccount = await fetchAccount(prepareRemintAccount)
    } catch (error) {
      console.error(JSON.stringify(error))
      throw new Error(`Could not validate if prepareRemintAccount already exists on Persona`)
    }
    if (remintAccount) {
      throw new Error(
        `\
        The remint account is already the reference id for persona account ${remintAccount.personaId}!
        For this script to run successfully there cannot be an existing account whose reference id is
        the remint account. To fix these issue use Persona's consolidate accounts api (https://docs.withpersona.com/reference/consolidate-into-an-account)
        to merge account ${remintAccount.personaId} into ${personaAccount.personaId}
        `
      )
    }
  }

  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})

  // Remove Firebase user state BEFORE burning the UID so there's no window of opportunity after
  // successful burning in which the Unique Identity Signer could be used to re-mint using the
  // obsolete Persona-related state.
  await destroyUser(burnAccount, parseInt(burnUidType), network, signer, provider)

  // On-chain burn. Make sure the burnerPrivateKey wallet is sufficiently funded with ETH
  await burnUID(burnAccount, burnUidType, signer, burnerPrivateKey)

  if (prepareRemintAccount) {
    // Replacing the user's Persona account's reference id will allow them to pass document verification
    // using the prepareRemintAccount
    console.log(`updating reference id for account to be ${prepareRemintAccount}`)
    const updatedPersonaAccount = await updateReferenceId(personaAccount, prepareRemintAccount)
    console.log(updatedPersonaAccount)
  } else {
    console.log("No re-mint address provided. Exiting.")
  }
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

export default main
