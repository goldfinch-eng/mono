import { gql } from "@apollo/client";

import { Button, Spinner } from "@/components/design-system";
import { formatGfi, formatUsdc } from "@/lib/format";
import { useCurrentUserWalletInfoQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

gql`
  query CurrentUserWalletInfo {
    currentUser @client {
      usdcBalance
      gfiBalance
    }
  }
`;

interface WalletInfoProps {
  onWalletDisconnect: () => void;
}

export function WalletStatus({ onWalletDisconnect }: WalletInfoProps) {
  const { connector } = useWallet();
  const { data } = useCurrentUserWalletInfoQuery();
  const usdcBalance = data?.currentUser.usdcBalance
    ? formatUsdc(data.currentUser.usdcBalance)
    : undefined;
  const gfiBalance = data?.currentUser.gfiBalance
    ? formatGfi(data.currentUser.gfiBalance)
    : undefined;

  return (
    <div className="min-w-[320px] space-y-8">
      <div>
        <div className="mb-4 text-lg font-semibold">Balances</div>
        <div className="flex items-center justify-between">
          <div className="font-medium">USDC</div>
          <div>
            <div>{usdcBalance ?? <Spinner />}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="font-medium">GFI</div>
          <div>
            <div>{gfiBalance ?? <Spinner />}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-4 text-lg font-semibold">Recent Transactions</div>
        <div>TODO</div>
      </div>
      <div className="text-center">
        <Button
          size="sm"
          onClick={() => {
            connector.deactivate();
            onWalletDisconnect();
          }}
        >
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}
