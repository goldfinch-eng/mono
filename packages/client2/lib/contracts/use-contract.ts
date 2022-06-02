import { Provider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import {
  Erc20,
  Erc20__factory,
  SeniorPool,
  SeniorPool__factory,
  StakingRewards,
  StakingRewards__factory,
  TranchedPool,
  TranchedPool__factory,
  UniqueIdentity,
  UniqueIdentity__factory,
} from "@/types/ethers-contracts";

import { useWallet } from "../wallet";

type KnownContractName =
  | "SeniorPool"
  | "TranchedPool"
  | "StakingRewards"
  | "USDC"
  | "UniqueIdentity";

type Contract<T extends KnownContractName> = T extends "SeniorPool"
  ? SeniorPool
  : T extends "TranchedPool"
  ? TranchedPool
  : T extends "StakingRewards"
  ? StakingRewards
  : T extends "USDC"
  ? Erc20
  : T extends "UniqueIdentity"
  ? UniqueIdentity
  : never;

export function getContract<T extends KnownContractName>({
  name,
  chainId,
  provider,
  address,
}: {
  name: T;
  chainId: number;
  provider: Provider | Signer;
  address?: string;
}): Contract<T> {
  const _address = address ?? CONTRACT_ADDRESSES[chainId][name];
  if (!_address) {
    throw new Error(
      `Unable to find address for contract ${name} on chainId ${chainId}`
    );
  }
  if (name === "SeniorPool") {
    // yeah the type coercion to <Contract<T>> is weird but it's the only way to make the compiler stop complaining about the conditional return type
    return SeniorPool__factory.connect(_address, provider) as Contract<T>;
  } else if (name === "TranchedPool") {
    return TranchedPool__factory.connect(_address, provider) as Contract<T>;
  } else if (name === "StakingRewards") {
    return StakingRewards__factory.connect(_address, provider) as Contract<T>;
  } else if (name === "USDC") {
    return Erc20__factory.connect(_address, provider) as Contract<T>;
  } else if (name === "UniqueIdentity") {
    return UniqueIdentity__factory.connect(_address, provider) as Contract<T>;
  } else {
    throw new Error("Invalid contract name");
  }
}

export function useContract<T extends KnownContractName>(
  name: T,
  address?: string,
  useSigner = true
): Contract<T> | undefined {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const contract = getContract({
        name,
        chainId,
        provider: useSigner ? provider.getSigner() : provider,
        address,
      });
      return contract;
    }
  }, [name, address, useSigner, provider, chainId]);
}
