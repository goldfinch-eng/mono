import BN from "bn.js"
import {decodeAndGetFirstLog, erc20Approve, getNumShares} from "@goldfinch-eng/protocol/test/testHelpers"
import {StakedPositionType, TRANCHES} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  UniqueIdentityInstance,
  ERC20Instance,
  FiduInstance,
  MembershipOrchestratorInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  PoolTokensInstance,
  GoldfinchConfigInstance,
  GoInstance,
  CapitalLedgerInstance,
  GFIInstance,
  GFILedgerInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {TokenMinted} from "@goldfinch-eng/protocol/typechain/truffle/contracts/interfaces/IPoolTokens"
import {GoldfinchFactoryInstance} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/GoldfinchFactory"
import {createTranchedPool} from "./tranchedPool"
import {mintUidIfNotMinted} from "./uniqueIdentity"
import {CapitalERC721Deposit} from "@goldfinch-eng/protocol/typechain/truffle/contracts/interfaces/ICapitalLedger"
import {GFIDeposit} from "@goldfinch-eng/protocol/typechain/truffle/contracts/interfaces/IGFILedger"

export enum DepositType {
  GFI,
  StakedFidu,
  PoolToken,
}

export type DepositRequest = {
  depositType: DepositType
  amount: BN
}

interface SetupAndDepositMultiple {
  ownerAddress: string
  depositRequests: DepositRequest[]
  signer: string
  hre: HardhatRuntimeEnvironment
  borrowerAddress: string
  protocolOwner: string
  gfi: GFIInstance
  gfiLedger: GFILedgerInstance
  fidu: FiduInstance
  membershipOrchestrator: MembershipOrchestratorInstance
  capitalLedger: CapitalLedgerInstance
  seniorPool: SeniorPoolInstance
  stakingRewards: StakingRewardsInstance
  uniqueIdentity: UniqueIdentityInstance
  usdc: ERC20Instance
  go: GoInstance
  goldfinchConfig: GoldfinchConfigInstance
  goldfinchFactory: GoldfinchFactoryInstance
  poolTokens: PoolTokensInstance
}

export type DepositResult = {
  depositType: DepositType
  positionId: BN
  assetTokenId?: BN
  depositAmount?: BN
  depositResult: Truffle.TransactionResponse<any>
}

export const setupAndDepositMultiple = async (input: SetupAndDepositMultiple): Promise<DepositResult[]> => {
  const depositResults: DepositResult[] = []
  for (const depositRequest of input.depositRequests) {
    switch (depositRequest.depositType) {
      case DepositType.GFI:
        depositResults.push(
          await setupAndDepositGfi({...input, gfiDepositAmount: depositRequest.amount}).then((depositResult) => {
            return {
              positionId: depositResult.positionId,
              depositType: DepositType.GFI,
              depositResult: depositResult.depositResult,
            }
          })
        )
        break
      case DepositType.PoolToken:
        depositResults.push(
          await setupAndDepositPoolToken({...input, usdcDepositAmount: depositRequest.amount}).then((depositResult) => {
            return {
              positionId: depositResult.positionId,
              depositType: DepositType.PoolToken,
              assetTokenId: depositResult.poolTokenId,
              depositResult: depositResult.depositResult,
            }
          })
        )
        break
      case DepositType.StakedFidu:
        depositResults.push(
          await setupAndDepositStakedFidu({...input, usdcDepositAmount: depositRequest.amount}).then(
            (depositResult) => {
              return {
                positionId: depositResult.positionId,
                depositType: DepositType.StakedFidu,
                assetTokenId: depositResult.stakedFiduTokenId,
                depositAmount: depositResult.amountOfStakedFidu,
                depositResult: depositResult.depositResult,
              }
            }
          )
        )
    }
  }
  return depositResults
}

interface SetupAndDepositGfi {
  ownerAddress: string
  gfiDepositAmount: BN
  gfi: GFIInstance
  gfiLedger: GFILedgerInstance
  fidu: FiduInstance
  membershipOrchestrator: MembershipOrchestratorInstance
}

// Setup a GFI position for the given ownerAddress:
// Use given uniqueIdentity to mint a UID to the user
// Use given usdc, seniorPool, and Fidu to deposit into the senior pool and mint corresponding fidu to the ownerAddress.
// Use given stakingRewards to stake the fidu to the stakingRewards contract.
// Approve the StakedFidu for the membership orchestrator and deposit the StakedFidu into the membership orchestrator.
//
export const setupAndDepositGfi = async ({
  ownerAddress,
  gfiDepositAmount,
  gfi,
  gfiLedger,
  membershipOrchestrator,
}: SetupAndDepositGfi): Promise<{
  positionId: BN
  depositResult: Truffle.TransactionResponse<any>
}> => {
  await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: ownerAddress})
  const depositResult = await membershipOrchestrator.deposit(
    {gfi: String(gfiDepositAmount), capitalDeposits: []},
    {from: ownerAddress}
  )
  const depositEvent = decodeAndGetFirstLog<GFIDeposit>(depositResult.receipt.rawLogs, gfiLedger, "GFIDeposit")
  return {positionId: depositEvent.args.positionId, depositResult}
}

interface SetupAndDepositStakedFidu {
  ownerAddress: string
  signer: string
  usdcDepositAmount: BN
  capitalLedger: CapitalLedgerInstance
  fidu: FiduInstance
  membershipOrchestrator: MembershipOrchestratorInstance
  seniorPool: SeniorPoolInstance
  stakingRewards: StakingRewardsInstance
  uniqueIdentity: UniqueIdentityInstance
  usdc: ERC20Instance
  hre: HardhatRuntimeEnvironment
}

// Setup a Staked Fidu position for the given ownerAddress:
// Use given uniqueIdentity to mint a UID to the user
// Use given usdc, seniorPool, and Fidu to deposit into the senior pool and mint corresponding fidu to the ownerAddress.
// Use given stakingRewards to stake the fidu to the stakingRewards contract.
// Approve the StakedFidu for the membership orchestrator and deposit the StakedFidu into the membership orchestrator.
//
export const setupAndDepositStakedFidu = async (
  input: SetupAndDepositStakedFidu
): Promise<{
  stakedFiduTokenId: BN
  amountOfStakedFidu: BN
  positionId: BN
  depositResult: Truffle.TransactionResponse<any>
}> => {
  const {stakedFiduTokenId, amountOfStakedFidu} = await setupStakedFiduPosition(input)
  await input.stakingRewards.approve(input.membershipOrchestrator.address, String(stakedFiduTokenId), {
    from: input.ownerAddress,
  })
  const depositResult = await input.membershipOrchestrator.deposit(
    {
      gfi: "0",
      capitalDeposits: [{assetAddress: input.stakingRewards.address, id: String(stakedFiduTokenId)}],
    },
    {from: input.ownerAddress}
  )
  const depositEvent = decodeAndGetFirstLog<CapitalERC721Deposit>(
    depositResult.receipt.rawLogs,
    input.capitalLedger,
    "CapitalERC721Deposit"
  )
  return {stakedFiduTokenId, amountOfStakedFidu, positionId: depositEvent.args.positionId, depositResult}
}

interface SetupAndDepositPoolToken {
  hre: HardhatRuntimeEnvironment
  borrowerAddress: string
  ownerAddress: string
  protocolOwner: string
  signer: string
  usdcDepositAmount: BN
  capitalLedger: CapitalLedgerInstance
  go: GoInstance
  goldfinchConfig: GoldfinchConfigInstance
  goldfinchFactory: GoldfinchFactoryInstance
  membershipOrchestrator: MembershipOrchestratorInstance
  poolTokens: PoolTokensInstance
  uniqueIdentity: UniqueIdentityInstance
  usdc: ERC20Instance
}

// Setup a Pool Token position for the given ownerAddress:
// Use given uniqueIdentity to mint a UID to the user
// Create a new pool using the given goldfinchFactory and goldfinchConfig
// Use given stakingRewards to stake the fidu to the stakingRewards contract.
// Approve the PoolToken for the membership orchestrator and deposit the PoolToken into the membership orchestrator.
export const setupAndDepositPoolToken = async (
  input: SetupAndDepositPoolToken
): Promise<{
  poolTokenId: BN
  positionId: BN
  tranchedPoolAddress: string
  depositResult: Truffle.TransactionResponse<any>
}> => {
  const {poolTokenId, tranchedPoolAddress} = await setupPoolTokenPosition(input)
  await input.poolTokens.approve(input.membershipOrchestrator.address, String(poolTokenId), {
    from: input.ownerAddress,
  })
  const depositResult = await input.membershipOrchestrator.deposit(
    {
      gfi: "0",
      capitalDeposits: [{assetAddress: input.poolTokens.address, id: String(poolTokenId)}],
    },
    {from: input.ownerAddress}
  )
  const depositEvent = decodeAndGetFirstLog<CapitalERC721Deposit>(
    depositResult.receipt.rawLogs,
    input.capitalLedger,
    "CapitalERC721Deposit"
  )
  return {poolTokenId, tranchedPoolAddress, positionId: depositEvent.args.positionId, depositResult}
}

interface SetupStakedFiduPosition {
  ownerAddress: string
  signer: string
  usdcDepositAmount: BN
  fidu: FiduInstance
  seniorPool: SeniorPoolInstance
  stakingRewards: StakingRewardsInstance
  uniqueIdentity: UniqueIdentityInstance
  usdc: ERC20Instance
  hre: HardhatRuntimeEnvironment
}

// Setup a Staked Fidu position for the given ownerAddress:
// Use given uniqueIdentity to mint a UID to the user
// Use given usdc, seniorPool, and Fidu to deposit into the senior pool and mint corresponding fidu to the ownerAddress.
// Use given stakingRewards to stake the fidu to the stakingRewards contract.
// Return the newly staked fidu position token id.
export const setupStakedFiduPosition = async ({
  ownerAddress,
  signer,
  usdcDepositAmount,
  fidu,
  seniorPool,
  stakingRewards,
  uniqueIdentity,
  usdc,
  hre,
}: SetupStakedFiduPosition): Promise<{stakedFiduTokenId: BN; amountOfStakedFidu: BN}> => {
  await mintUidIfNotMinted(hre, new BN(1), uniqueIdentity, ownerAddress, signer)
  await usdc.approve(seniorPool.address, usdcDepositAmount, {from: ownerAddress})
  await seniorPool.deposit(usdcDepositAmount, {from: ownerAddress})
  const amountOfStakedFidu = getNumShares(usdcDepositAmount, await seniorPool.sharePrice()).sub(new BN(1))

  await fidu.approve(stakingRewards.address, String(amountOfStakedFidu), {from: ownerAddress})
  const stakedFiduTokenId = await stakingRewards.stake.call(String(amountOfStakedFidu), StakedPositionType.Fidu, {
    from: ownerAddress,
  })
  await stakingRewards.stake(String(amountOfStakedFidu), StakedPositionType.Fidu, {from: ownerAddress})
  return {stakedFiduTokenId, amountOfStakedFidu}
}

interface SetupPoolTokenPosition {
  hre: HardhatRuntimeEnvironment
  borrowerAddress: string
  ownerAddress: string
  protocolOwner: string
  signer: string
  usdcDepositAmount: BN
  go: GoInstance
  goldfinchConfig: GoldfinchConfigInstance
  goldfinchFactory: GoldfinchFactoryInstance
  poolTokens: PoolTokensInstance
  uniqueIdentity: UniqueIdentityInstance
  usdc: ERC20Instance
}

// Setup a Pool Token position for the given ownerAddress:
// Use given uniqueIdentity to mint a UID to the user
// Create a new pool using the given goldfinchFactory and goldfinchConfig
// Use given stakingRewards to stake the fidu to the stakingRewards contract.
// Return the newly staked fidu position token id.
export const setupPoolTokenPosition = async ({
  hre,
  borrowerAddress,
  ownerAddress,
  signer,
  usdcDepositAmount,
  go,
  goldfinchConfig,
  goldfinchFactory,
  poolTokens,
  uniqueIdentity,
  usdc,
}: SetupPoolTokenPosition): Promise<{poolTokenId: BN; tranchedPoolAddress: string}> => {
  await mintUidIfNotMinted(hre, new BN(0), uniqueIdentity, ownerAddress, signer)

  const tranchedPool = await createTranchedPool({
    hre,
    borrowerAddress,
    ownerAddress,
    go,
    goldfinchConfig,
    goldfinchFactory,
    usdc,
  })

  await erc20Approve(usdc, tranchedPool.address, usdcDepositAmount, [ownerAddress])

  const tokenMintedResult = await tranchedPool.deposit(TRANCHES.Junior, String(usdcDepositAmount), {
    from: ownerAddress,
  })
  const tokenMinted = decodeAndGetFirstLog<TokenMinted>(tokenMintedResult.receipt.rawLogs, poolTokens, "TokenMinted")
  const poolTokenId = tokenMinted.args.tokenId

  // Pool must be drawn down to be eligible for membership
  await tranchedPool.lockJuniorCapital({from: borrowerAddress})
  await tranchedPool.lockPool({from: borrowerAddress})

  return {poolTokenId, tranchedPoolAddress: tranchedPool.address}
}
