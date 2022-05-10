import { gql } from "@apollo/client";

import { Button, Spinner } from "@/components/design-system";
import {
  usdcFromAtomic,
  formatUsdcAsDollars,
  gfiFromAtomic,
  formatGfiAsDollars,
} from "@/lib/format";
import { useCurrentUserWalletInfoQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import GfiSvg from "./gfi.svg";
import UsdcSvg from "./usdc.svg";

gql`
  query CurrentUserWalletInfo {
    gfi {
      price {
        usd
      }
    }
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
    ? usdcFromAtomic(data.currentUser.usdcBalance)
    : undefined;
  const usdcBalanceAsDollars = data?.currentUser.usdcBalance
    ? formatUsdcAsDollars(data.currentUser.usdcBalance)
    : undefined;
  const gfiBalance = data?.currentUser.gfiBalance
    ? gfiFromAtomic(data.currentUser.gfiBalance)
    : undefined;
  const gfiPrice = data?.gfi?.price.usd;
  const gfiBalanceAsDollars =
    gfiPrice && data?.currentUser.gfiBalance
      ? formatGfiAsDollars(data.currentUser.gfiBalance, gfiPrice)
      : undefined;

  return (
    <div className="min-w-[320px] space-y-8">
      <div>
        <div className="mb-4 text-lg font-semibold">Balances</div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <UsdcSvg className="h-6 w-6" />
            <span className="font-medium">USDC</span>
          </div>
          <div className="text-right">
            <div>{usdcBalance ?? <Spinner />}</div>
            <div className="text-xs">{usdcBalanceAsDollars}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <GfiSvg className="h-6 w-6" />
            <span className="font-medium">GFI</span>
          </div>
          <div className="text-right">
            <div>{gfiBalance ?? <Spinner />}</div>
            <div className="text-xs">{gfiBalanceAsDollars}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-4 text-lg font-semibold">Recent Transactions</div>
        <div>TODO</div>
      </div>
      <div className="text-center">
        <Button
          colorScheme="secondary"
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
