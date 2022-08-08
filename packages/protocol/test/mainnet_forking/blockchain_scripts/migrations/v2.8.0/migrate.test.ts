import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import hre, {deployments, ethers, getNamedAccounts} from "hardhat"
import {asNonNullable} from "@goldfinch-eng/utils"
import {getProtocolOwner, OWNER_ROLE, SIGNER_ROLE} from "packages/protocol/blockchain_scripts/deployHelpers"
import {assertIsString} from "packages/utils/src/type"

import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import * as migrate280 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.8.0/migrate"
import {MINT_PAYMENT} from "../../../../uniqueIdentityHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {
  getCurrentTimestamp,
  getDeployedAsTruffleContract,
  SECONDS_PER_DAY,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {getExistingContracts} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers/getExistingContracts"
import {MAINNET_GOVERNANCE_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {
  presignedMintMessage,
  presignedMintToMessage,
  presignedBurnMessage,
} from "packages/utils/src/uniqueIdentityHelpers"
import {UniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"

const setupTest = deployments.createFixture(async () => {
  // await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)

  const [_owner, _signer, _anotherUser, _anotherUser2, _anotherUser3] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const signerAddress = asNonNullable(_signer)
  const anotherUser = asNonNullable(_anotherUser)
  const anotherUser2 = asNonNullable(_anotherUser2)
  const anotherUser3 = asNonNullable(_anotherUser3)

  const protocolOwner = await getProtocolOwner()

  await fundWithWhales(
    ["USDC", "BUSD", "USDT", "ETH"],
    [protocolOwner, gf_deployer, owner, signerAddress, anotherUser, anotherUser2, anotherUser3]
  )
  await impersonateAccount(hre, protocolOwner)

  await migrate280.main()
  await impersonateAccount(hre, MAINNET_GOVERNANCE_MULTISIG)

  const uniqueIdentityDeploy = await getDeployedAsTruffleContract<UniqueIdentityInstance>(deployments, "UniqueIdentity")
  const uniqueIdentity = await ethers.getContractAt(uniqueIdentityDeploy.abi, uniqueIdentityDeploy.address)
  // const uniqueIdentity = await artifacts.require("UniqueIdentity").at(existingUniqueIdentity.address)

  const protocolOwnerSigner = await hre.ethers.getSigner(protocolOwner)
  await uniqueIdentity.connect(protocolOwnerSigner).grantRole(OWNER_ROLE, owner)
  await uniqueIdentity.connect(protocolOwnerSigner).grantRole(SIGNER_ROLE, signerAddress)
  return {
    uniqueIdentity,
    owner,
    signerAddress,
    anotherUser,
    anotherUser2,
    anotherUser3,
  }
})

describe("v2.8.0", async function () {
  let signerAddress: string,
    signer: any,
    tokenId: number,
    timestamp: number,
    anotherUser: string,
    anotherUser2: string,
    anotherUser3: string,
    uniqueIdentity: any
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({signerAddress, anotherUser, anotherUser2, uniqueIdentity} = await setupTest())

    tokenId = 0
    signer = hre.ethers.provider.getSigner(signerAddress)
    timestamp = (await getCurrentTimestamp()).add(SECONDS_PER_DAY).toNumber()
  })

  describe("mint", () => {
    it("updates state and emits an event", async () => {
      const nonce = await uniqueIdentity.nonces(anotherUser2)
      expect((await uniqueIdentity.balanceOf(anotherUser2, tokenId)).toString()).to.eq("0")
      const presignedMint = await presignedMintMessage(
        anotherUser2,
        tokenId,
        timestamp,
        uniqueIdentity.address,
        nonce,
        1
      )
      const mintSig = signer.signMessage(presignedMint)
      await expect(
        uniqueIdentity.connect(hre.ethers.provider.getSigner(anotherUser2)).mint(tokenId, timestamp, mintSig, {
          value: MINT_PAYMENT.toNumber(),
        })
      ).to.be.fulfilled
      expect((await uniqueIdentity.balanceOf(anotherUser2, tokenId)).toString()).to.eq("1")
      const nonce2 = await uniqueIdentity.nonces(anotherUser2)
      const presignedBurn = await presignedBurnMessage(
        anotherUser2,
        tokenId,
        timestamp,
        uniqueIdentity.address,
        nonce2,
        1
      )
      const burnSig = signer.signMessage(presignedBurn)
      await expect(
        uniqueIdentity
          .connect(hre.ethers.provider.getSigner(anotherUser3))
          .burn(anotherUser2, tokenId, timestamp, burnSig)
      ).to.be.fulfilled
      expect((await uniqueIdentity.balanceOf(anotherUser2, tokenId)).toString()).to.eq("0")
    })
  })

  describe("mintTo", () => {
    it("updates state and emits an event", async () => {
      const nonce = await uniqueIdentity.nonces(anotherUser2)
      expect((await uniqueIdentity.balanceOf(anotherUser, tokenId)).toString()).to.eq("0")
      const presignedMintTo = await presignedMintToMessage(
        anotherUser2,
        anotherUser,
        tokenId,
        timestamp,
        uniqueIdentity.address,
        nonce,
        1
      )
      const mintToSig = signer.signMessage(presignedMintTo)
      await expect(
        uniqueIdentity
          .connect(hre.ethers.provider.getSigner(anotherUser2))
          .mintTo(anotherUser, tokenId, timestamp, mintToSig, {
            value: MINT_PAYMENT.toNumber(),
          })
      ).to.be.fulfilled
      expect((await uniqueIdentity.balanceOf(anotherUser, tokenId)).toString()).to.eq("1")
      const nonce2 = await uniqueIdentity.nonces(anotherUser)
      const presignedBurn = await presignedBurnMessage(
        anotherUser,
        tokenId,
        timestamp,
        uniqueIdentity.address,
        nonce2,
        1
      )
      const burnSig = signer.signMessage(presignedBurn)
      await expect(
        uniqueIdentity
          .connect(hre.ethers.provider.getSigner(anotherUser3))
          .burn(anotherUser, tokenId, timestamp, burnSig)
      ).to.be.fulfilled
      expect((await uniqueIdentity.balanceOf(anotherUser, tokenId)).toString()).to.eq("0")
    })
  })
})
