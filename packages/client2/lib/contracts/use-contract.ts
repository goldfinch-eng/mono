import { getProvider } from "@wagmi/core";
import { Signer } from "ethers";

import { CONTRACT_ADDRESSES } from "@/constants";

const supportedContracts = {
  SeniorPool: () =>
    import("@/types/ethers-contracts/factories/SeniorPool__factory").then(
      (module) => module.SeniorPool__factory.connect
    ),
  TranchedPool: () =>
    import("@/types/ethers-contracts/factories/TranchedPool__factory").then(
      (module) => module.TranchedPool__factory.connect
    ),
  GFI: () =>
    import("@/types/ethers-contracts/factories/Erc20__factory").then(
      (module) => module.Erc20__factory.connect
    ),
  USDC: () =>
    import("@/types/ethers-contracts/factories/Erc20__factory").then(
      (module) => module.Erc20__factory.connect
    ),
  Fidu: () =>
    import("@/types/ethers-contracts/factories/Erc20__factory").then(
      (module) => module.Erc20__factory.connect
    ),
  UniqueIdentity: () =>
    import("@/types/ethers-contracts/factories/UniqueIdentity__factory").then(
      (module) => module.UniqueIdentity__factory.connect
    ),
  StakingRewards: () =>
    import("@/types/ethers-contracts/factories/StakingRewards__factory").then(
      (module) => module.StakingRewards__factory.connect
    ),
  Zapper: () =>
    import("@/types/ethers-contracts/factories/Zapper__factory").then(
      (module) => module.Zapper__factory.connect
    ),
  CreditLine: () =>
    import("@/types/ethers-contracts/factories/CreditLine__factory").then(
      (module) => module.CreditLine__factory.connect
    ),
  CommunityRewards: () =>
    import("@/types/ethers-contracts/factories/CommunityRewards__factory").then(
      (module) => module.CommunityRewards__factory.connect
    ),
  MerkleDistributor: () =>
    import(
      "@/types/ethers-contracts/factories/MerkleDistributor__factory"
    ).then((module) => module.MerkleDistributor__factory.connect),
  BackerMerkleDistributor: () =>
    import(
      "@/types/ethers-contracts/factories/BackerMerkleDistributor__factory"
    ).then((module) => module.BackerMerkleDistributor__factory.connect),
  MerkleDirectDistributor: () =>
    import(
      "@/types/ethers-contracts/factories/MerkleDirectDistributor__factory"
    ).then((module) => module.MerkleDirectDistributor__factory.connect),
  BackerMerkleDirectDistributor: () =>
    import(
      "@/types/ethers-contracts/factories/BackerMerkleDirectDistributor__factory"
    ).then((module) => module.BackerMerkleDirectDistributor__factory.connect),
  BackerRewards: () =>
    import("@/types/ethers-contracts/factories/BackerRewards__factory").then(
      (module) => module.BackerRewards__factory.connect
    ),
  CurvePool: () =>
    import("@/types/ethers-contracts/factories/CurvePool__factory").then(
      (module) => module.CurvePool__factory.connect
    ),
  CurveLP: () =>
    import("@/types/ethers-contracts/factories/Erc20__factory").then(
      (module) => module.Erc20__factory.connect
    ),
  WithdrawalRequestToken: () =>
    import(
      "@/types/ethers-contracts/factories/WithdrawalRequestToken__factory"
    ).then((module) => module.WithdrawalRequestToken__factory.connect),
  PoolTokens: () =>
    import("@/types/ethers-contracts/factories/PoolTokens__factory").then(
      (module) => module.PoolTokens__factory.connect
    ),
  MembershipOrchestrator: () =>
    import(
      "@/types/ethers-contracts/factories/MembershipOrchestrator__factory"
    ).then((module) => module.MembershipOrchestrator__factory.connect),
  MembershipVault: () =>
    import("@/types/ethers-contracts/factories/MembershipVault__factory").then(
      (module) => module.MembershipVault__factory.connect
    ),
  ERC20Splitter: () =>
    import("@/types/ethers-contracts/factories/Erc20Splitter__factory").then(
      (module) => module.Erc20Splitter__factory.connect
    ),
  Borrower: () =>
    import("@/types/ethers-contracts/factories/Borrower__factory").then(
      (module) => module.Borrower__factory.connect
    ),
  GoldfinchConfig: () =>
    import("@/types/ethers-contracts/factories/GoldfinchConfig__factory").then(
      (module) => module.GoldfinchConfig__factory.connect
    ),
  CallableLoan: () =>
    import("@/types/ethers-contracts/factories/CallableLoan__factory").then(
      (module) => module.CallableLoan__factory.connect
    ),
};

type SupportedContractName = keyof typeof supportedContracts;

type Contract<T extends SupportedContractName> = ReturnType<
  Awaited<ReturnType<typeof supportedContracts[T]>>
>;

export async function getContract<T extends SupportedContractName>({
  name,
  address,
  signer,
}: {
  name: T;
  address?: string;
  signer?: Signer;
}): Promise<Contract<T>> {
  const _address =
    address ?? CONTRACT_ADDRESSES[name as keyof typeof CONTRACT_ADDRESSES];
  if (!_address) {
    throw new Error(`Unable to find address for contract ${name}`);
  }
  const connectFn = await supportedContracts[name]();
  const provider = getProvider();
  if (connectFn) return connectFn(_address, signer ?? provider) as Contract<T>; // yeah the type coercion to <Contract<T>> is weird but it's the only way to make the compiler stop complaining about the conditional return type
  throw new Error("Invalid contract name");
}
