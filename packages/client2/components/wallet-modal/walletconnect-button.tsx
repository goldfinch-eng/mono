import { Spinner } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";
import {
  walletConnect,
  walletConnectHooks,
} from "@/lib/wallet/connectors/walletconnect";

import { ProviderButton } from "./provider-button";
import WalletConnectLogo from "./walletconnect-logo.svg";

export function WalletConnectButton() {
  const handleConnection = () => {
    walletConnect.activate(DESIRED_CHAIN_ID);
  };
  const isActive = walletConnectHooks.useIsActive();
  const isActivating = walletConnectHooks.useIsActivating();
  const error = walletConnectHooks.useError();

  return (
    <ProviderButton onClick={handleConnection} errorMessage={error?.message}>
      {`WalletConnect${isActive ? " (Connected)" : ""}`}
      {isActivating ? (
        <Spinner className="!h-10 !w-10 text-[#3f99fc]" />
      ) : (
        <WalletConnectLogo className="h-10 w-10" />
      )}
    </ProviderButton>
  );
}
