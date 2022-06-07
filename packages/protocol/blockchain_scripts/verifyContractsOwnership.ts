import {constants as ethersConstants, Contract} from "ethers"
import fs from "fs"
import {deployments, ethers} from "hardhat"
import difference from "lodash/difference"
import every from "lodash/every"
import {assertNonEmptyString, isNonEmptyString, isPlainObject} from "../../utils/src/type"
import {getDeployedContract, OWNER_ROLE} from "./deployHelpers"
import {
  MAINNET_CREDIT_DESK,
  MAINNET_GF_DEPLOYER,
  MAINNET_GOVERNANCE_MULTISIG,
  MAINNET_WARBLER_LABS_MULTISIG,
} from "./mainnetForkingHelpers"

const ZERO_BYTES32 = ethersConstants.HashZero

const expectedProtocolContractNamesWithoutAnyOwnership: Record<string, true> = {
  Accountant: true,
  BackerMerkleDistributor: true,
  ConfigOptions: true,
  MerkleDistributor: true,
  TestForwarder: true,
  TranchingLogic: true,
}

type OwnershipVerificationConfig = {
  expectedOwners: string[] | undefined
}
type VerificationResult = {
  ok: boolean
}

async function _contractExplicitOwnerVerifier(contract: Contract): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const owner = await contract.owner()
  if (owner == MAINNET_GOVERNANCE_MULTISIG) {
    console.log("Contract is explicitly owned by Governance multi-sig.")
  } else {
    contractIssue = true
    console.error(`[CRITICAL] Expected contract to have explicit \`owner\` (Governance multi-sig), but found: ${owner}`)
  }

  return {ok: !contractIssue}
}
async function _contractNoExplicitOwnerVerifier(contract: Contract): Promise<VerificationResult> {
  console.log("")
  let contractHasExplicitOwner = false

  let owner: string | undefined
  try {
    owner = await contract.owner()
    contractHasExplicitOwner = true
  } catch (err: unknown) {
    if ((err as any).message !== "contract.owner is not a function") {
      throw new Error("Unexpected error reading `owner`.")
    }
  }

  if (contractHasExplicitOwner) {
    console.error(`[CRITICAL] Expected contract not to have explicit \`owner\`, but it does: ${owner}`)
  } else {
    console.error("Contract has no explicit `owner`, as expected.")
  }

  return {ok: !contractHasExplicitOwner}
}

async function _contractRoleBasedAccessControlConfiguredVerifier(contract: Contract): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const OWNER_ROLE = await contract.OWNER_ROLE()
  const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE()

  const adminRoleOfOwnerRole = await contract.getRoleAdmin(OWNER_ROLE)
  if (adminRoleOfOwnerRole === OWNER_ROLE) {
    console.log("Admin role of OWNER_ROLE is itself.")
  } else if (adminRoleOfOwnerRole === DEFAULT_ADMIN_ROLE) {
    if (DEFAULT_ADMIN_ROLE === ZERO_BYTES32) {
      console.log("Admin role of OWNER_ROLE is zero-bytes DEFAULT_ADMIN_ROLE.")
    } else {
      contractIssue = true
      console.error(
        `[CRITICAL] Admin role of OWNER_ROLE is some non-zero-bytes DEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`
      )
    }

    const defaultAdminRoleMemberCount = Number((await contract.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).toString())
    if (defaultAdminRoleMemberCount) {
      contractIssue = true

      const defaultAdminRoleMembers = await Promise.all(
        Array(defaultAdminRoleMemberCount)
          .fill("")
          .map((_, i) => contract.getRoleMember(DEFAULT_ADMIN_ROLE, i))
      )

      console.error(`[CRITICAL] DEFAULT_ADMIN_ROLE unexpectedly has non-zero members: ${defaultAdminRoleMembers}`)
    } else {
      console.log(`No one has the DEFAULT_ADMIN_ROLE.`)
    }
  } else {
    contractIssue = true
    console.error(`[CRITICAL] Admin role of OWNER_ROLE is a different role: ${adminRoleOfOwnerRole}`)
  }

  return {ok: !contractIssue}
}
async function _contractRoleBasedAccessControlNotConfiguredVerifier(contract: Contract): Promise<VerificationResult> {
  console.log("")
  let contractHasRoleBasedAccessControl = false

  try {
    await contract.OWNER_ROLE()
    contractHasRoleBasedAccessControl = true
  } catch (err: unknown) {
    if ((err as any).message !== "contract.OWNER_ROLE is not a function") {
      throw new Error("Unexpected error reading OWNER_ROLE.")
    }
  }

  try {
    await contract.DEFAULT_ADMIN_ROLE()
    contractHasRoleBasedAccessControl = true
  } catch (err: unknown) {
    if ((err as any).message !== "contract.DEFAULT_ADMIN_ROLE is not a function") {
      throw new Error("Unexpected error reading DEFAULT_ADMIN_ROLE.")
    }
  }

  if (contractHasRoleBasedAccessControl) {
    console.error("[CRITICAL] Expected contract not to have role-based access control, but it does.")
  } else {
    console.log("Contract has no role-based access control, as expected.")
  }

  return {ok: !contractHasRoleBasedAccessControl}
}

async function _contractOwnerRoleVerifier(
  contract: Contract,
  config: OwnershipVerificationConfig,
  describeExpectedOwner: (expectedOwner: string) => string
): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const ownerCount = Number((await contract.getRoleMemberCount(OWNER_ROLE)).toString())
  if (config.expectedOwners && config.expectedOwners.length) {
    if (ownerCount === config.expectedOwners.length) {
      for (const expectedOwner of config.expectedOwners) {
        const expectedOwnerIsOwner = await contract.hasRole(OWNER_ROLE, expectedOwner)
        if (expectedOwnerIsOwner) {
          console.log(`Contract is owned by ${describeExpectedOwner(expectedOwner)}.`)
        } else {
          contractIssue = true
          console.error(`[CRITICAL] Expected owner ${expectedOwner} lacks OWNER_ROLE!`)
        }
      }
    } else {
      contractIssue = true

      console.error(
        `[CRITICAL] Expected ${config.expectedOwners.length} owners, but contract has ${ownerCount} owners!`
      )
      if (ownerCount) {
        const owners = await Promise.all(
          Array(ownerCount)
            .fill("")
            .map((_, i) => contract.getRoleMember(OWNER_ROLE, i))
        )
        const unexpectedOwners = difference(owners, config.expectedOwners)
        console.error(`[CRITICAL] Unexpected owners: ${unexpectedOwners}`)
      }
    }
  } else {
    if (ownerCount) {
      contractIssue = true
      console.error(`[CRITICAL] Expected no contract owners, but contract has owners.`)
    } else {
      console.log("Contract has no owners, as expected.")
    }
  }

  return {ok: !contractIssue}
}

function _getRoleBasedAccessControlledContractExpectedOwners(name: string): string[] {
  if (name.endsWith("_Implementation")) {
    return []
  } else {
    switch (name) {
      case "UniqueIdentity":
        return [MAINNET_GOVERNANCE_MULTISIG, MAINNET_WARBLER_LABS_MULTISIG]
      case "TranchedPool":
      case "CreditLine":
      case "MigratedTranchedPool":
        return []
      case "V2Migrator":
        return [MAINNET_GOVERNANCE_MULTISIG, MAINNET_GF_DEPLOYER]
      case "Pool":
        return [MAINNET_GOVERNANCE_MULTISIG, MAINNET_CREDIT_DESK]
      default:
        return [MAINNET_GOVERNANCE_MULTISIG]
    }
  }
}

async function verifyProtocolContractsOwnership(): Promise<VerificationResult> {
  const allDeployedContractNames = Object.keys(await deployments.all())

  return _verifyContractsOwnership(
    "protocol contracts",
    allDeployedContractNames,
    async (name: string): Promise<VerificationResult> => {
      const contract = await getDeployedContract(deployments, name)

      if (name in expectedProtocolContractNamesWithoutAnyOwnership) {
        // Confirm that contract has no explicit `owner`.
        const noExplicitOwnerResult = await _contractNoExplicitOwnerVerifier(contract)

        // Confirm that contract does not have role-based access control.
        const rolesBasedNotConfiguredResult = await _contractRoleBasedAccessControlNotConfiguredVerifier(contract)

        return {ok: noExplicitOwnerResult.ok && rolesBasedNotConfiguredResult.ok}
      } else if (name.endsWith("_Proxy")) {
        // Confirm that contract has explicit Governance `owner`.
        const explicitOwnerResult = await _contractExplicitOwnerVerifier(contract)

        // Confirm that contract does not have role-based access control.
        const rolesBasedNotConfiguredResult = await _contractRoleBasedAccessControlNotConfiguredVerifier(contract)

        return {ok: explicitOwnerResult.ok && rolesBasedNotConfiguredResult.ok}
      } else {
        // Confirm that contract has no explicit `owner`.
        const noExplicitOwnerResult = await _contractNoExplicitOwnerVerifier(contract)

        // Confirm that the roles-based access control has been configured so that OWNER_ROLE does
        // indeed "own" the contract.
        const rolesBaseConfiguredResult = await _contractRoleBasedAccessControlConfiguredVerifier(contract)

        // Confirm who has the OWNER_ROLE.
        const expectedOwners = _getRoleBasedAccessControlledContractExpectedOwners(name)
        const ownerRoleResult = await _contractOwnerRoleVerifier(
          contract,
          {expectedOwners},
          (expectedOwner: string): string => {
            switch (expectedOwner) {
              case MAINNET_GOVERNANCE_MULTISIG:
                return "Governance multi-sig"
              case MAINNET_WARBLER_LABS_MULTISIG:
                return "Warbler Labs multi-sig"
              case MAINNET_GF_DEPLOYER:
                return "Goldfinch deployer"
              case MAINNET_CREDIT_DESK:
                return "CreditDesk contract"
              default:
                throw new Error(`Unexpected expected-owner: ${expectedOwner}`)
            }
          }
        )

        return {ok: noExplicitOwnerResult.ok && rolesBaseConfiguredResult.ok && ownerRoleResult.ok}
      }
    },
    (name: string): string => name
  )
}

type MainnetTranchedPoolsJson = {
  [address: string]: {
    name: string
  }
}
const isMainnetTranchedPoolsJson = (json: unknown): json is MainnetTranchedPoolsJson => {
  return (
    isPlainObject(json) &&
    every(json, (val: unknown, key: unknown): boolean => {
      return isNonEmptyString(key) && isPlainObject(val) && isNonEmptyString(val.name)
    })
  )
}

const fileOptions: {encoding: BufferEncoding} = {encoding: "utf8"}
const pathToMainnetTranchedPoolsJson = "../client/config/pool-metadata/mainnet.json"
const mainnetTranchedPoolsJson = JSON.parse(fs.readFileSync(pathToMainnetTranchedPoolsJson, fileOptions))

if (!isMainnetTranchedPoolsJson(mainnetTranchedPoolsJson)) {
  throw new Error("Unexpected mainnet tranched pools json.")
}

// Cf. https://www.notion.so/goldfinchfinance/Borrower-Addresses-4ccccde54b8a451e8c38de22d116355e
const borrowerContractAddressByTranchedPoolAddress = {
  "0xd43a4f3041069c6178b99d55295b00d0db955bb5": "0xd750033CD9ab91EaD99074f671bBcBCE0FFd91A8",
  "0x1e73b5C1A3570B362d46Ae9Bf429b25c05e514A7": "0x54aff655036db5741e805583a1589f81f8e697ea",
  "0x3634855ec1BeAf6F9BE0f7d2f67fC9Cb5F4EEeA4": "0x71693a31d4026edaf24bd192bd51558d442bb2ef",
  "0x9e8B9182ABbA7b4C188C979bC8F4C79F7f4c90d3": "0x71693a31d4026edaf24bd192bd51558d442bb2ef",
  "0x8bbd80F88e662e56B918c353DA635E210ECe93C6": "0x71693a31d4026edaf24bd192bd51558d442bb2ef",
  "0xd798d527F770ad920BB50680dBC202bB0a1DaFD6": "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e",
  "0x2107adE0E536b8b0b85cca5E0c0C3F66E58c053C": "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e",
  "0x1CC90f7bB292DAB6FA4398F3763681cFE497Db97": "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e",
  "0x67df471EaCD82c3dbc95604618FF2a1f6b14b8a1": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xe32c22e4D95caE1fB805C60C9e0026ed57971BCf": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xefeB69eDf6B6999B0e3f2Fa856a2aCf3bdEA4ab5": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xC13465CE9Ae3Aa184eB536F04FDc3f54D2dEf277": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xe6C30756136e07eB5268c3232efBFBe645c1BA5A": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0x1d596D28A7923a22aA013b0e7082bbA23DAA656b": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0x418749e294cAbce5A714EfcCC22a8AAde6F9dB57": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0x759f097f3153f5d62FF1C2D82bA78B6350F223e3": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xaA2ccC5547f64C5dFfd0a624eb4aF2543A67bA65": "0x33fCf9230AD1d2950EE562fF0888b7240C7aa8eA",
  "0xF74ea34ac88862B7Ff419e60E476BE2651433e68": "0x53799810ee9919c3bAD470952f016f4E7c67C9a8",
  "0xc9BDd0D3B80CC6EfE79a82d850f44EC9B55387Ae": "0xd750033CD9ab91EaD99074f671bBcBCE0FFd91A8",
  "0xd09a57127BC40D680Be7cb061C2a6629Fe71AbEf": "0xd750033CD9ab91EaD99074f671bBcBCE0FFd91A8",
  "0x00c27FC71b159a346e179b4A1608a0865e8A7470": "0xf8C4A0fEDf9b249253D89203034374E5A57b617C",
  "0xb26B42Dd5771689D0a7faEea32825ff9710b9c11": "0x37E12D7AbFF5a2636aCc3Dced31030F3Ed9cc0F8",
  "0x89d7C618a4EeF3065DA8ad684859a547548E6169": "0xf0721f76527f5388eC8C952b033C6113362BCa88",
}

const expectedBorrowerContractOwnerByContractAddress = {
  "0x54aff655036db5741e805583a1589f81f8e697ea": "0xC4aA3F35d54E6aAe7b32fBD239D309A3C805A156",
  "0x71693a31d4026edaf24bd192bd51558d442bb2ef": "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC",
  "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e": "0x8652854C25bd553d522d118AC2bee6FFA3Cce317",
  "0xcf595641c40008fdc97e5ccbce710ab4d31539a3": "0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6",
  "0x33fCf9230AD1d2950EE562fF0888b7240C7aa8eA": "0x9892245a6A6A0706bF10a59129ba9CBf0e1033e3",
  "0x53799810ee9919c3bAD470952f016f4E7c67C9a8": "0xD677476BeF65Fa6B3AaB8Defeb0E5bFD69848036",
  "0xd750033CD9ab91EaD99074f671bBcBCE0FFd91A8": "0xFF27f53fdEC54f2077F80350c7011F76f84f9622",
  "0xf8C4A0fEDf9b249253D89203034374E5A57b617C": "0x3253e0bdac8475440ffead59c7b063db7eccb50f",
  "0x37E12D7AbFF5a2636aCc3Dced31030F3Ed9cc0F8": "0xb2A3D20999975E31727890c5084CC4A9458740F0",
  "0xf0721f76527f5388eC8C952b033C6113362BCa88": "0xEF1A2cBbFE289bA586db860CfE360058ac3944E7",
}

const borrowerNameByBorrowerContractExpectedOwnerAddress = {
  "0xC4aA3F35d54E6aAe7b32fBD239D309A3C805A156": "Payjoy",
  "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC": "Aspire",
  "0x8652854C25bd553d522d118AC2bee6FFA3Cce317": "QuickCheck",
  "0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6": "Almavest",
  "0x9892245a6A6A0706bF10a59129ba9CBf0e1033e3": "Tugende",
  "0xD677476BeF65Fa6B3AaB8Defeb0E5bFD69848036": "Divibank",
  "0xFF27f53fdEC54f2077F80350c7011F76f84f9622": "Cauris",
  "0x3253e0bdac8475440ffead59c7b063db7eccb50f": "Stratos",
  "0xb2A3D20999975E31727890c5084CC4A9458740F0": "Lendeast",
  "0xEF1A2cBbFE289bA586db860CfE360058ac3944E7": "Addem Capital",
}

async function verifyBorrowerContractsOwnership() {
  const tranchedPoolAddresses = Object.keys(mainnetTranchedPoolsJson)

  return _verifyContractsOwnership(
    "borrower contracts",
    tranchedPoolAddresses,
    async (tranchedPoolAddress: string): Promise<VerificationResult> => {
      const borrowerContractAddress = borrowerContractAddressByTranchedPoolAddress[tranchedPoolAddress]
      console.log("BORROWER CONTRACT ADDRESS", borrowerContractAddress, tranchedPoolAddress)
      assertNonEmptyString(borrowerContractAddress)

      const borrowerContract = await ethers.getContractAt("Borrower", borrowerContractAddress)

      const rolesBasedConfiguredResult = await _contractRoleBasedAccessControlConfiguredVerifier(borrowerContract)

      const expectedOwner = expectedBorrowerContractOwnerByContractAddress[borrowerContractAddress]
      console.log("EXPECTED OWNER", expectedOwner)
      assertNonEmptyString(expectedOwner)
      const expectedOwners = [expectedOwner]
      const ownerRoleResult = await _contractOwnerRoleVerifier(
        borrowerContract,
        {
          expectedOwners,
        },
        (expectedOwner): string => {
          const borrowerName = borrowerNameByBorrowerContractExpectedOwnerAddress[expectedOwner]
          if (borrowerName) {
            return borrowerName
          } else {
            throw new Error(`Unexpected expected-owner: ${expectedOwner}`)
          }
        }
      )

      return {ok: rolesBasedConfiguredResult.ok && ownerRoleResult.ok}
    },
    (tranchedPoolAddress: string): string => {
      const name = mainnetTranchedPoolsJson[tranchedPoolAddress].name
      assertNonEmptyString(name)
      return name
    }
  )
}

async function _verifyContractsOwnership(
  description: string,
  keys: string[],
  verifier: (key: string) => Promise<VerificationResult>,
  getVerifierHeading: (key: string) => string
): Promise<VerificationResult> {
  console.log("#########################################")
  console.log(`Verifying ownership of ${description}`)
  console.log("#########################################")

  let anyIssue = false
  for (const key of keys) {
    const heading = getVerifierHeading(key)
    console.log("**********************")
    console.log(heading)
    console.log("**********************")

    const result = await verifier(key)

    console.log("")
    if (result.ok) {
      console.log("OK")
    } else {
      anyIssue = true
      console.error(`${key} HAS ISSUE ^^^`)
    }
    console.log("")
  }

  return {ok: !anyIssue}
}

export async function verifyContractsOwnership(): Promise<void> {
  const protocolContractsResult = await verifyProtocolContractsOwnership()
  const borrowerContractsResult = await verifyBorrowerContractsOwnership()

  if (!protocolContractsResult.ok || !borrowerContractsResult.ok) {
    throw new Error("Found ownership issues!")
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  verifyContractsOwnership()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default verifyContractsOwnership
