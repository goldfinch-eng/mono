import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"

import {assertWithLoadedInfo} from "../../types/loadable"

import {Web3IO} from "../../types/web3"
import {BlockInfo} from "../../utils"
import {BackerMerkleDirectDistributorLoaded} from "../backerMerkleDirectDistributor"
import {BackerMerkleDistributorLoaded} from "../backerMerkleDistributor"
import {getBorrowerContract} from "../borrower"
import {CommunityRewardsLoaded} from "../communityRewards"
import {GFILoaded} from "../gfi"
import {GoldfinchProtocol} from "../GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "../merkleDirectDistributor"
import {MerkleDistributorLoaded} from "../merkleDistributor"
import {SeniorPoolLoaded, StakingRewardsLoaded} from "../pool"
import {User, UserLoaded} from "./User"

export default async function getUserData(
  address: string,
  goldfinchProtocol: GoldfinchProtocol,
  pool: SeniorPoolLoaded,
  creditDesk: Web3IO<CreditDesk>,
  networkId: string,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  communityRewards: CommunityRewardsLoaded,
  merkleDistributor: MerkleDistributorLoaded,
  merkleDirectDistributor: MerkleDirectDistributorLoaded,
  backerMerkleDistributor: BackerMerkleDistributorLoaded,
  backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded,
  currentBlock: BlockInfo
): Promise<UserLoaded> {
  const borrower = await getBorrowerContract(address, goldfinchProtocol, currentBlock)

  const user = new User(address, networkId, creditDesk, goldfinchProtocol, borrower)
  await user.initialize(
    pool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    backerMerkleDistributor,
    backerMerkleDirectDistributor,
    currentBlock
  )
  assertWithLoadedInfo(user)
  return user
}
