import {UniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {BN, getCurrentTimestamp, SECONDS_PER_DAY} from "../testHelpers"
import {mint} from "../uniqueIdentityHelpers"

export const mintUidIfNotMinted = async (
  hre: HardhatRuntimeEnvironment,
  uidTokenId: BN,
  uniqueIdentity: UniqueIdentityInstance,
  ownerAddress: string,
  signer: string
) => {
  const existingUidBalance = await uniqueIdentity.balanceOf(ownerAddress, uidTokenId)
  if (existingUidBalance.eq(new BN(0))) {
    const nonce = await uniqueIdentity.nonces(ownerAddress)
    const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    await mint(hre, uniqueIdentity, uidTokenId, expiresAt, nonce, signer, undefined, ownerAddress)
  }
}
