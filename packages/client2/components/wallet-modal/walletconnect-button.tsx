import { Spinner } from "@/components/design-system";
import {
  walletConnect,
  walletConnectHooks,
} from "@/lib/wallet/connectors/walletconnect";

import { ProviderButton } from "./provider-button";
import WalletConnectLogo from "./walletconnect-logo.svg";

export function WalletConnectButton() {
  const handleConnection = () => {
    walletConnect.activate();
  };
  const isActive = walletConnectHooks.useIsActive();
  const isActivating = walletConnectHooks.useIsActivating();

  return (
    <ProviderButton
      disabled={isActive || isActivating}
      onClick={handleConnection}
    >
      {`WalletConnect${isActive ? " (Connected)" : ""}`}
      {isActivating ? (
        <Spinner style={{ color: "#3f99fc" }} />
      ) : (
        <WalletConnectLogo className="h-8 w-8" />
      )}
    </ProviderButton>
  );
}
