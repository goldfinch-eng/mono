import { gql } from "@apollo/client";

import { Button, Shimmer } from "@/components/design-system";
import { formatCrypto, formatFiat, cryptoToFloat } from "@/lib/format";
import {
  SupportedFiat,
  useCurrentUserWalletInfoQuery,
} from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import GfiSvg from "./gfi.svg";
import UsdcSvg from "./usdc.svg";

gql`
  query CurrentUserWalletInfo {
    gfiPrice(fiat: USD) {
      price {
        amount
      }
    }
    viewer @client(always: true) {
      account
      usdcBalance {
        token
        amount
      }
      gfiBalance {
        token
        amount
      }
    }
  }
`;

interface WalletInfoProps {
  onWalletDisconnect: () => void;
}

export function WalletStatus({ onWalletDisconnect }: WalletInfoProps) {
  const { connector } = useWallet();
  const { data, loading } = useCurrentUserWalletInfoQuery();
  const viewer = data?.viewer;

  const gfiPrice = data?.gfiPrice.price.amount;
  const gfiBalanceAsFiat =
    viewer?.gfiBalance && gfiPrice
      ? formatFiat({
          symbol: SupportedFiat.Usd,
          amount: gfiPrice * cryptoToFloat(viewer?.gfiBalance),
        })
      : null;

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
            <div>
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : viewer?.usdcBalance ? (
                formatCrypto(viewer.usdcBalance, { includeSymbol: false })
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <GfiSvg className="h-6 w-6" />
            <span className="font-medium">GFI</span>
          </div>
          <div className="text-right">
            <div>
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : viewer?.gfiBalance ? (
                formatCrypto(viewer.gfiBalance)
              ) : null}
            </div>
            <div className="text-xs">
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : gfiBalanceAsFiat ? (
                gfiBalanceAsFiat
              ) : null}
            </div>
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
