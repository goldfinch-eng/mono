import { Button, Popover } from "@/components/design-system";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import { Identicon } from "../identicon";
import { WalletInfo } from "./wallet-info";

export function WalletButton() {
  const { account } = useWallet();

  return account ? (
    <Popover
      placement="bottom-end"
      content={({ close }) => <WalletInfo onWalletDisconnect={close} />}
    >
      <Button className="inline-flex items-center gap-3">
        <span>
          {account.substring(0, 6)}...{account.substring(account.length - 4)}
        </span>
        <Identicon account={account} scale={3} />
      </Button>
    </Popover>
  ) : (
    <Button onClick={openWalletModal}>Connect Wallet</Button>
  );
}
