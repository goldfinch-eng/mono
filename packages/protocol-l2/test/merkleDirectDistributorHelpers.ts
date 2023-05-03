import {
  JsonAccountedDirectGrant,
  MerkleDirectDistributorInfo,
} from "../blockchain_scripts/merkle/merkleDirectDistributor/types"

import blockchainScriptsFixtures from "./blockchain_scripts/merkle/merkleDirectDistributor/fixtures"

export const fixtures: {
  input: JsonAccountedDirectGrant[]
  output: MerkleDirectDistributorInfo
} = {
  input: blockchainScriptsFixtures.input,
  output: blockchainScriptsFixtures.output,
}
