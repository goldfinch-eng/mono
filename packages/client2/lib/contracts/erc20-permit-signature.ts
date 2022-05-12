import { Web3Provider } from "@ethersproject/providers";
import { BigNumber, utils } from "ethers";

import { Erc20 } from "@/types/ethers-contracts";

interface Args {
  /**
   * Instance of an ERC20 token contract (for example, what you'd get when you call useUsdcContract())
   */
  erc20TokenContract: Erc20;
  /**
   * Web3Provider, for example what's obtained from useWallet()
   */
  provider: Web3Provider;
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
  provider,
  owner,
  spender,
  value,
  deadline,
}: Args) {
  const chainId = provider.network.chainId;
  const domain = {
    name: await erc20TokenContract.name(),
    version: chainId === 1 ? "2" : "1",
    chainId: chainId,
    verifyingContract: erc20TokenContract.address,
  };
  const EIP712_DOMAIN_TYPE = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const nonce = await erc20TokenContract.nonces(owner);
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

  const dataForSigning = JSON.stringify({
    types: {
      EIP712Domain: EIP712_DOMAIN_TYPE,
      Permit: EIP2612_TYPE,
    },
    domain,
    primaryType: "Permit",
    message,
  });

  const signature = await provider
    .send("eth_signTypedData_v4", [owner, dataForSigning])
    .then(utils.splitSignature);
  return signature;
}
