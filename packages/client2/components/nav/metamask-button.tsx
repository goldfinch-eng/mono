import { Button } from "@/components/design-system";
import { metaMask, metaMaskHooks } from "@/lib/wallet/connectors/metamask";

import MetaMaskLogo from "./metamask-logo.svg";

export function MetaMaskButton() {
  const isActive = metaMaskHooks.useIsActive();
  const isActivating = metaMaskHooks.useIsActivating();
  const handleConnectMetaMask = () => {
    metaMask.activate();
  };
  return (
    <Button
      className="flex items-center"
      colorScheme="sand"
      disabled={isActive || isActivating}
      onClick={handleConnectMetaMask}
    >
      <MetaMaskLogo className="mr-2 h-8 w-8" />
      MetaMask
      {isActive ? " (Connected)" : isActivating ? " (Connecting...)" : null}
    </Button>
  );
}
