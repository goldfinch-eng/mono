import { Button, Popover } from "@/components/design-system";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import { Identicon } from "../identicon";
import { WalletStatus } from "./wallet-status";

export function WalletButton() {
  const { account, isActivating, error } = useWallet();

  return error ? (
    <Button
      variant="rounded"
      className="h-10 text-clay-500"
      iconRight="Exclamation"
      colorScheme="secondary"
    >
      {error.name === "ChainIdNotAllowedError"
        ? "Wrong network"
        : "Wallet error"}
    </Button>
  ) : account ? (
    <Popover
      placement="bottom-end"
      content={({ close }) => <WalletStatus onWalletDisconnect={close} />}
    >
      <Button
        className="inline-flex h-10 items-center gap-3 !px-2 md:!px-4"
        variant="rounded"
        colorScheme="secondary"
      >
        <span className="hidden md:block">
          {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </span>
        <Identicon account={account} scale={3} />
      </Button>
    </Popover>
  ) : (
    <Button
      className="h-10"
      variant="rounded"
      colorScheme="primary"
      onClick={openWalletModal}
      isLoading={isActivating}
      disabled={isActivating}
    >
      Connect Wallet
    </Button>
  );
}
