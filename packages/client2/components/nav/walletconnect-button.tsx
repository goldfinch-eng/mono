import { Button } from "@/components/design-system";
import {
  walletConnect,
  walletConnectHooks,
} from "@/lib/wallet/connectors/walletconnect";

import WalletConnectLogo from "./walletconnect-logo.svg";

export function WalletConnectButton() {
  const handleConnection = () => {
    walletConnect.activate();
  };
  const isActive = walletConnectHooks.useIsActive();
  const isActivating = walletConnectHooks.useIsActivating();

  return (
    <Button
      className="flex items-center"
      colorScheme="sand"
      disabled={isActive || isActivating}
      onClick={handleConnection}
    >
      <WalletConnectLogo className="mr-2 h-8 w-8" />
      WalletConnect
      {isActive ? " (Connected)" : isActivating ? " (Connecting...)" : null}
    </Button>
  );
}
