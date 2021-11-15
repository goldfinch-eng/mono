import {JsonAccountedGrant, MerkleDistributorInfo} from "../blockchain_scripts/merkle/merkleDistributor/types"

import blockchainScriptsFixtures from "./blockchain_scripts/merkle/merkleDistributor/fixtures"

export const fixtures: {
  input: JsonAccountedGrant[]
  output: MerkleDistributorInfo
} = {
  input: blockchainScriptsFixtures.input,
  output: blockchainScriptsFixtures.output,
}
