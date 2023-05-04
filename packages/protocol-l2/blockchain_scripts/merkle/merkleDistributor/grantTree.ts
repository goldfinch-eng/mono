import MerkleTree from "../common/merkleTree"
import {utils} from "ethers"
import {AccountedGrant, Grant} from "./types"

export default class GrantTree {
  private readonly tree: MerkleTree
  constructor(accountedGrants: AccountedGrant[]) {
    this.tree = new MerkleTree(
      accountedGrants.map((accountedGrant: AccountedGrant, index: number) => {
        return GrantTree.toNode(index, accountedGrant.account, accountedGrant.grant)
      })
    )
  }

  public static verifyProof(index: number, account: string, grant: Grant, proof: Buffer[], root: Buffer): boolean {
    let pair = GrantTree.toNode(index, account, grant)
    for (const item of proof) {
      pair = MerkleTree.combinedHash({first: pair, second: item})
    }

    return pair.equals(root)
  }

  // keccak256(abi.encode(index, account, amount, vestingLength, cliffLength, vestingInterval))
  public static toNode(index: number, account: string, grant: Grant): Buffer {
    return Buffer.from(
      utils
        .solidityKeccak256(
          ["uint256", "address", "uint256", "uint256", "uint256", "uint256"],
          [index, account, grant.amount, grant.vestingLength, grant.cliffLength, grant.vestingInterval]
        )
        .substr(2),
      "hex"
    )
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot()
  }

  // returns the hex bytes32 values of the proof
  public getProof(index: number, account: string, grant: Grant): string[] {
    return this.tree.getHexProof(GrantTree.toNode(index, account, grant))
  }
}
