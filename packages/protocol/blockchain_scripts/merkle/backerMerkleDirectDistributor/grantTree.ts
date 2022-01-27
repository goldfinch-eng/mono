import MerkleTree from "../common/merkleTree"
import {utils} from "ethers"
import {AccountedDirectGrant, DirectGrant} from "./types"

export default class GrantTree {
  private readonly tree: MerkleTree
  constructor(accountedGrants: AccountedDirectGrant[]) {
    this.tree = new MerkleTree(
      accountedGrants.map((accountedGrant: AccountedDirectGrant, index: number) => {
        return GrantTree.toNode(index, accountedGrant.account, accountedGrant.grant)
      })
    )
  }

  public static verifyProof(
    index: number,
    account: string,
    grant: DirectGrant,
    proof: Buffer[],
    root: Buffer
  ): boolean {
    let pair = GrantTree.toNode(index, account, grant)
    for (const item of proof) {
      pair = MerkleTree.combinedHash({first: pair, second: item})
    }

    return pair.equals(root)
  }

  // keccak256(abi.encode(index, account, amount))
  public static toNode(index: number, account: string, grant: DirectGrant): Buffer {
    return Buffer.from(
      utils.solidityKeccak256(["uint256", "address", "uint256"], [index, account, grant.amount]).substr(2),
      "hex"
    )
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot()
  }

  // returns the hex bytes32 values of the proof
  public getProof(index: number, account: string, grant: DirectGrant): string[] {
    return this.tree.getHexProof(GrantTree.toNode(index, account, grant))
  }
}
