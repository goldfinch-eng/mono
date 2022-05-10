import { Button, Popover } from "@/components/design-system";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import { Identicon } from "../identicon";
import { WalletStatus } from "./wallet-status";

export function WalletButton() {
  const { account } = useWallet();

  return account ? (
    <Popover
      placement="bottom-end"
      content={({ close }) => <WalletStatus onWalletDisconnect={close} />}
    >
      <Button
        className="inline-flex h-10 items-center gap-3"
        variant="rounded"
        colorScheme="secondary"
      >
        <span>
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
    >
      Connect Wallet
    </Button>
  );
}
