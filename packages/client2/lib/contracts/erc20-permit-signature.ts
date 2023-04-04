import { signTypedData } from "@wagmi/core";
import { BigNumber, utils } from "ethers";

import type { Erc20 } from "@/types/ethers-contracts";

interface Args {
  /**
   * Instance of an ERC20 token contract (for example, what you'd get when you call useUsdcContract())
   */
  erc20TokenContract: Erc20;
  /**
   * Chain ID for the for currently connected chain
   */
  chainId: number;
  /**
   * The address of the wallet owner (AKA the account)
   */
  owner: string;
  /**
   * The address of the contract that will be spending the token (for example, the address of a tranched pool)
   */
  spender: string;
  /**
   * Amount of token to spend
   */
  value: BigNumber;
  /**
   * Timestamp (seconds) indicating when the permit expires
   */
  deadline: BigNumber;
}

export async function generateErc20PermitSignature({
  erc20TokenContract,
  chainId,
  owner,
  spender,
  value,
  deadline,
}: Args) {
  const [name, nonce] = await Promise.all([
    erc20TokenContract.name(),
    erc20TokenContract.nonces(owner),
  ]);
  const domain = {
    name,
    version: chainId === 1 && name === "USD Coin" ? "2" : "1", // we don't have the `version()` function on our fake USDC contract in dev, hence the conditional here
    chainId,
    verifyingContract: erc20TokenContract.address as `0x${string}`,
  };

  const message = {
    owner,
    spender,
    value: value.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };
  const EIP2612_TYPE = [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ];

  // Referenced some code to figure out how to set up this signature for ERC20 permits: https://www.quicknode.com/guides/ethereum-development/transactions/how-to-use-erc20-permit-approval/
  const signature = await signTypedData({
    domain,
    types: { Permit: EIP2612_TYPE },
    value: message,
  }).then(utils.splitSignature);

  return signature;
}
