import { gql } from "@apollo/client";

import { Button, Shimmer } from "@/components/design-system";
import { formatUsdc } from "@/lib/format";
import { useCurrentUserWalletInfoQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

gql`
  query CurrentUserWalletInfo {
    currentUser @client {
      usdcBalance
    }
  }
`;

interface WalletInfoProps {
  onWalletDisconnect: () => void;
}

export function WalletInfo({ onWalletDisconnect }: WalletInfoProps) {
  const { connector } = useWallet();
  const { data } = useCurrentUserWalletInfoQuery();
  const usdcBalance = data?.currentUser.usdcBalance
    ? formatUsdc(data.currentUser.usdcBalance)
    : undefined;

  return (
    <div className="min-w-[320px] space-y-8">
      <div>
        <div className="mb-4 text-lg font-semibold">Balances</div>
        <div className="flex items-center justify-between">
          <div className="font-medium">USDC</div>
          <div>
            <div>{usdcBalance ?? <Shimmer />}</div>
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
