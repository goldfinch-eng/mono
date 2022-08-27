import { Provider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import {
  Erc20__factory,
  Fidu__factory,
  Gfi__factory,
  SeniorPool__factory,
  StakingRewards__factory,
  TranchedPool__factory,
  UniqueIdentity__factory,
  Zapper__factory,
  CreditLine__factory,
  CommunityRewards__factory,
  MerkleDistributor__factory,
  BackerMerkleDistributor__factory,
  MerkleDirectDistributor__factory,
  BackerMerkleDirectDistributor__factory,
  BackerRewards__factory,
  CurvePool__factory,
} from "@/types/ethers-contracts";

import { useWallet } from "../wallet";

const supportedContracts = {
  SeniorPool: SeniorPool__factory.connect,
  TranchedPool: TranchedPool__factory.connect,
  GFI: Gfi__factory.connect,
  USDC: Erc20__factory.connect,
  Fidu: Fidu__factory.connect,
  UniqueIdentity: UniqueIdentity__factory.connect,
  StakingRewards: StakingRewards__factory.connect,
  Zapper: Zapper__factory.connect,
  CreditLine: CreditLine__factory.connect,
  CommunityRewards: CommunityRewards__factory.connect,
  MerkleDistributor: MerkleDistributor__factory.connect,
  BackerMerkleDistributor: BackerMerkleDistributor__factory.connect,
  MerkleDirectDistributor: MerkleDirectDistributor__factory.connect,
  BackerMerkleDirectDistributor: BackerMerkleDirectDistributor__factory.connect,
  BackerRewards: BackerRewards__factory.connect,
  CurvePool: CurvePool__factory.connect,
  CurveLP: Erc20__factory.connect,
};

type SupportedContractName = keyof typeof supportedContracts;

type Contract<T extends SupportedContractName> = ReturnType<
  typeof supportedContracts[T]
>;

export function getContract<T extends SupportedContractName>({
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
  const _address =
    address ?? CONTRACT_ADDRESSES[name as keyof typeof CONTRACT_ADDRESSES];
  if (!_address) {
    throw new Error(
      `Unable to find address for contract ${name} on chainId ${chainId}`
    );
  }
  const connectFn = supportedContracts[name];
  if (connectFn) return connectFn(_address, provider) as Contract<T>; // yeah the type coercion to <Contract<T>> is weird but it's the only way to make the compiler stop complaining about the conditional return type
  throw new Error("Invalid contract name");
}

export function useContract<T extends SupportedContractName>(
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
