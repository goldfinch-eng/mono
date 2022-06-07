import {constants as ethersConstants, Contract} from "ethers"
import fs from "fs"
import {deployments, ethers} from "hardhat"
import intersection from "lodash/intersection"
import difference from "lodash/difference"
import every from "lodash/every"
import mapKeys from "lodash/mapKeys"
import {assertNonEmptyString, assertNonNullable, isNonEmptyString, isPlainObject} from "../../utils/src/type"
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

const _protocolAddressDescriptionByLowercaseAddress = {
  [MAINNET_GOVERNANCE_MULTISIG.toLowerCase()]: "Governance multi-sig",
  [MAINNET_WARBLER_LABS_MULTISIG.toLowerCase()]: "Warbler Labs multi-sig",
  [MAINNET_GF_DEPLOYER.toLowerCase()]: "Goldfinch deployer",
  [MAINNET_CREDIT_DESK.toLowerCase()]: "CreditDesk contract",
}
const getProtocolAddressDescription = (address: string): string =>
  _protocolAddressDescriptionByLowercaseAddress[address.toLowerCase()] || address

type MemberVerificationConfig = {
  roleDescription: string
  role: string
  expectedMembers: string[]
}
type VerificationResult = {
  ok: boolean
}

async function _contractExplicitOwnerVerifier(contract: Contract, expectedOwner: string): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const owner = (await contract.owner()).toLowerCase()
  if (owner == expectedOwner.toLowerCase()) {
    console.log(`Contract has explicit \`owner\` as expected: ${getProtocolAddressDescription(expectedOwner)}`)
  } else {
    contractIssue = true
    console.error(
      `[CRITICAL] Expected contract to have explicit \`owner\` (${getProtocolAddressDescription(
        expectedOwner
      )}), but found: ${owner}`
    )
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

async function _contractRoleMemberVerifier(
  contract: Contract,
  config: MemberVerificationConfig,
  describeExpectedMember: (expectedMember: string) => string
): Promise<VerificationResult> {
  console.log("")
  let contractIssue = false

  const memberCount = Number((await contract.getRoleMemberCount(config.role)).toString())
  const members = (
    await Promise.all(
      Array(memberCount)
        .fill("")
        .map((_, i) => contract.getRoleMember(config.role, i))
    )
  ).map((owner: string) => owner.toLowerCase())
  const expectedMembers = config.expectedMembers.map((expectedMember: string) => expectedMember.toLowerCase())

  const membersAsExpected = intersection(expectedMembers, members)
  const missingMembers = difference(expectedMembers, members)
  const unexpectedMembers = difference(members, expectedMembers)

  if (membersAsExpected.length) {
    console.log(
      `Contract role ${config.roleDescription} has expected members: ${membersAsExpected.map(describeExpectedMember)}`
    )
  } else {
    console.log(`Contract role ${config.roleDescription} has no expected members.`)
  }
  if (missingMembers.length) {
    contractIssue = true
    console.error(
      `[CRITICAL] Contract role ${config.roleDescription} lacks expected members: ${missingMembers.map(
        describeExpectedMember
      )}`
    )
  } else {
    console.log(`Contract role ${config.roleDescription} lacks no expected members.`)
  }
  if (unexpectedMembers.length) {
    contractIssue = true
    console.error(
      `[CRITICAL] Contract role ${config.roleDescription} has unexpected members: ${unexpectedMembers.map(
        describeExpectedMember
      )}`
    )
  } else {
    console.log(`Contract role ${config.roleDescription} has no unexpected members.`)
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
        const explicitOwnerResult = await _contractExplicitOwnerVerifier(contract, MAINNET_GOVERNANCE_MULTISIG)

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
        const ownerRoleResult = await _contractRoleMemberVerifier(
          contract,
          {roleDescription: "OWNER_ROLE", role: OWNER_ROLE, expectedMembers: expectedOwners},
          (expectedOwner: string): string => getProtocolAddressDescription(expectedOwner)
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
const _mainnetTranchedPoolsJson = JSON.parse(fs.readFileSync(pathToMainnetTranchedPoolsJson, fileOptions))

if (!isMainnetTranchedPoolsJson(_mainnetTranchedPoolsJson)) {
  throw new Error("Unexpected mainnet tranched pools json.")
}

const mainnetTranchedPoolsJson: MainnetTranchedPoolsJson = mapKeys(_mainnetTranchedPoolsJson, (val, key) =>
  key.toLowerCase()
)

// Cf. https://www.notion.so/goldfinchfinance/Borrower-Addresses-4ccccde54b8a451e8c38de22d116355e
// NOTE: These addresses should be lowercased, for compatibility with the way we lowercase the
// keys from `mainnetTranchedPoolsJson` (see above).
const borrowerContractAddressByTranchedPoolAddress = {
  "0xd43a4f3041069c6178b99d55295b00d0db955bb5": "0xd750033cd9ab91ead99074f671bbcbce0ffd91a8",
  "0x1e73b5c1a3570b362d46ae9bf429b25c05e514a7": "0x54aff655036db5741e805583a1589f81f8e697ea",
  "0x3634855ec1beaf6f9be0f7d2f67fc9cb5f4eeea4": "0x71693a31d4026edaf24bd192bd51558d442bb2ef",
  "0x9e8b9182abba7b4c188c979bc8f4c79f7f4c90d3": "0x71693a31d4026edaf24bd192bd51558d442bb2ef",
  "0x8bbd80f88e662e56b918c353da635e210ece93c6": "0x71693a31d4026edaf24bd192bd51558d442bb2ef",
  "0xd798d527f770ad920bb50680dbc202bb0a1dafd6": "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e",
  "0x2107ade0e536b8b0b85cca5e0c0c3f66e58c053c": "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e",
  "0x1cc90f7bb292dab6fa4398f3763681cfe497db97": "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e",
  "0x67df471eacd82c3dbc95604618ff2a1f6b14b8a1": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xe32c22e4d95cae1fb805c60c9e0026ed57971bcf": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xc13465ce9ae3aa184eb536f04fdc3f54d2def277": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xe6c30756136e07eb5268c3232efbfbe645c1ba5a": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0x1d596d28a7923a22aa013b0e7082bba23daa656b": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0x418749e294cabce5a714efccc22a8aade6f9db57": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3": "0xcf595641c40008fdc97e5ccbce710ab4d31539a3",
  "0xaa2ccc5547f64c5dffd0a624eb4af2543a67ba65": "0x33fcf9230ad1d2950ee562ff0888b7240c7aa8ea",
  "0xf74ea34ac88862b7ff419e60e476be2651433e68": "0x53799810ee9919c3bad470952f016f4e7c67c9a8",
  "0xc9bdd0d3b80cc6efe79a82d850f44ec9b55387ae": "0xd750033cd9ab91ead99074f671bbcbce0ffd91a8",
  "0xd09a57127bc40d680be7cb061c2a6629fe71abef": "0xd750033cd9ab91ead99074f671bbcbce0ffd91a8",
  "0x00c27fc71b159a346e179b4a1608a0865e8a7470": "0xf8c4a0fedf9b249253d89203034374e5a57b617c",
  "0xb26b42dd5771689d0a7faeea32825ff9710b9c11": "0x37e12d7abff5a2636acc3dced31030f3ed9cc0f8",
  "0x89d7c618a4eef3065da8ad684859a547548e6169": "0xf0721f76527f5388ec8c952b033c6113362bca88",
}

const expectedBorrowerContractOwnerByContractAddress = {
  "0x54aff655036db5741e805583a1589f81f8e697ea": "0xc4aa3f35d54e6aae7b32fbd239d309a3c805a156",
  "0x71693a31d4026edaf24bd192bd51558d442bb2ef": "0xbd04f16cdd0e7e1ed8e4382aab3f0f7b17672ddc",
  "0x7d100b9932c9d200be8907e2c9b94ec7a23d371e": "0x8652854c25bd553d522d118ac2bee6ffa3cce317",
  "0xcf595641c40008fdc97e5ccbce710ab4d31539a3": "0x4bbd638eb377ea00b84fac2aa24a769a1516ecb6",
  "0x33fcf9230ad1d2950ee562ff0888b7240c7aa8ea": "0x9892245a6a6a0706bf10a59129ba9cbf0e1033e3",
  "0x53799810ee9919c3bad470952f016f4e7c67c9a8": "0xd677476bef65fa6b3aab8defeb0e5bfd69848036",
  "0xd750033cd9ab91ead99074f671bbcbce0ffd91a8": "0xff27f53fdec54f2077f80350c7011f76f84f9622",
  "0xf8c4a0fedf9b249253d89203034374e5a57b617c": "0x3253e0bdac8475440ffead59c7b063db7eccb50f",
  "0x37e12d7abff5a2636acc3dced31030f3ed9cc0f8": "0xb2a3d20999975e31727890c5084cc4a9458740f0",
  "0xf0721f76527f5388ec8c952b033c6113362bca88": "0xef1a2cbbfe289ba586db860cfe360058ac3944e7",
}

const borrowerNameByBorrowerContractExpectedOwnerAddress = {
  "0xc4aa3f35d54e6aae7b32fbd239d309a3c805a156": "Payjoy",
  "0xbd04f16cdd0e7e1ed8e4382aab3f0f7b17672ddc": "Aspire",
  "0x8652854c25bd553d522d118ac2bee6ffa3cce317": "QuickCheck",
  "0x4bbd638eb377ea00b84fac2aa24a769a1516ecb6": "Almavest",
  "0x9892245a6a6a0706bf10a59129ba9cbf0e1033e3": "Tugende",
  "0xd677476bef65fa6b3aab8defeb0e5bfd69848036": "Divibank",
  "0xff27f53fdec54f2077f80350c7011f76f84f9622": "Cauris",
  "0x3253e0bdac8475440ffead59c7b063db7eccb50f": "Stratos",
  "0xb2a3d20999975e31727890c5084cc4a9458740f0": "Lendeast",
  "0xef1a2cbbfe289ba586db860cfe360058ac3944e7": "Addem Capital",
}

async function verifyBorrowerContractsOwnership() {
  const tranchedPoolAddresses = Object.keys(mainnetTranchedPoolsJson)

  // TODO Verify who has LOCKER_ROLE on each tranched pool.

  return _verifyContractsOwnership(
    "borrower contract corresponding to tranched pool",
    tranchedPoolAddresses,
    async (tranchedPoolAddress: string): Promise<VerificationResult> => {
      const borrowerContractAddress = borrowerContractAddressByTranchedPoolAddress[tranchedPoolAddress]
      assertNonEmptyString(borrowerContractAddress)

      const borrowerContract = await ethers.getContractAt("Borrower", borrowerContractAddress)

      const rolesBasedConfiguredResult = await _contractRoleBasedAccessControlConfiguredVerifier(borrowerContract)

      const expectedOwner = expectedBorrowerContractOwnerByContractAddress[borrowerContractAddress]
      assertNonEmptyString(expectedOwner)
      const expectedOwners = [expectedOwner]
      const ownerRoleResult = await _contractRoleMemberVerifier(
        borrowerContract,
        {
          roleDescription: "OWNER_ROLE",
          role: OWNER_ROLE,
          expectedMembers: expectedOwners,
        },
        (expectedOwner): string => {
          const borrowerName = borrowerNameByBorrowerContractExpectedOwnerAddress[expectedOwner]
          if (borrowerName) {
            return borrowerName
          } else {
            return expectedOwner
          }
        }
      )

      return {ok: rolesBasedConfiguredResult.ok && ownerRoleResult.ok}
    },
    (tranchedPoolAddress: string): string => {
      const info = mainnetTranchedPoolsJson[tranchedPoolAddress]
      assertNonNullable(info)
      return info.name
    }
  )
}

async function _verifyContractsOwnership(
  description: string,
  keys: string[],
  verifier: (key: string) => Promise<VerificationResult>,
  getVerifierHeading: (key: string) => string
): Promise<VerificationResult> {
  console.log("")
  console.log("#########################################")
  console.log(`Verifying ownership of ${description}`)
  console.log("#########################################")

  let anyIssue = false
  for (const key of keys) {
    const heading = getVerifierHeading(key)
    console.log("")
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
