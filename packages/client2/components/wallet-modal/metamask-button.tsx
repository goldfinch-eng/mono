import { Spinner } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";
import { metaMask, metaMaskHooks } from "@/lib/wallet/connectors/metamask";

import MetaMaskLogo from "./metamask-logo.svg";
import { ProviderButton } from "./provider-button";

export function MetaMaskButton() {
  const isActive = metaMaskHooks.useIsActive();
  const isActivating = metaMaskHooks.useIsActivating();
  const error = metaMaskHooks.useError();
  const handleConnectMetaMask = () => {
    metaMask.activate(DESIRED_CHAIN_ID);
  };
  return (
    <ProviderButton
      onClick={handleConnectMetaMask}
      errorMessage={error?.message}
    >
      {`MetaMask${isActive ? " (Connected)" : ""}`}
      {isActivating ? (
        <Spinner className="!h-10 !w-10 text-[#f6851b]" />
      ) : (
        <MetaMaskLogo className="h-10 w-10" />
      )}
    </ProviderButton>
  );
}
