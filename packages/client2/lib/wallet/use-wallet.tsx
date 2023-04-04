import { useAccount, useProvider, useSigner } from "wagmi";

export function useWallet2() {
  const account = useAccount();
  const provider = useProvider();
  const { data: signer } = useSigner();
  return {
    account: account.address,
    provider,
    signer,
  };
}
