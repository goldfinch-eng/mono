import { Button, Popover } from "@/components/design-system";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import { WalletInfo } from "./wallet-info";

export function WalletButton() {
  const { account } = useWallet();

  return account ? (
    <Popover
      placement="bottom-end"
      content={({ close }) => <WalletInfo onWalletDisconnect={close} />}
    >
      <Button>
        <span className="inline-flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[#1AD12C]" />
          {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </span>
      </Button>
    </Popover>
  ) : (
    <Button onClick={openWalletModal}>Connect Wallet</Button>
  );
}
