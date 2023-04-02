import { useConnect } from "wagmi";

import { Spinner } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";
import { metaMaskConnector } from "@/lib/wallet/wagmi";

import MetaMaskLogo from "./metamask-logo.svg";
import { ProviderButton } from "./provider-button";

export function MetaMaskButton() {
  const {
    connect,
    data,
    error,
    isError,
    isSuccess,
    isLoading,
    pendingConnector,
  } = useConnect();
  const isActive = data?.connector?.id === "metaMask" && isSuccess;
  const isActivating = pendingConnector?.id === "metaMask" && isLoading;
  const errorMessage =
    pendingConnector?.id === "metaMask" && isError ? error?.message : undefined;
  const handleConnectMetaMask = () => {
    connect({ connector: metaMaskConnector, chainId: DESIRED_CHAIN_ID });
  };

  return (
    <ProviderButton onClick={handleConnectMetaMask} errorMessage={errorMessage}>
      {`MetaMask${isActive ? " (Connected)" : ""}`}
      {isActivating ? (
        <Spinner className="!h-10 !w-10 text-[#f6851b]" />
      ) : (
        <MetaMaskLogo className="h-10 w-10" />
      )}
    </ProviderButton>
  );
}
