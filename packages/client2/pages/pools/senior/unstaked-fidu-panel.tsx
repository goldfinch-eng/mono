import { BigNumber, FixedNumber } from "ethers";

import { Button } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { computeApyFromGfiInFiat, sharesToUsdc } from "@/lib/pools";

interface UnstakedFiduBannerProps {
  fiduBalance: CryptoAmount<"FIDU">;
  sharePrice: BigNumber;
  estimatedApyFromGfiRaw: FixedNumber;
  fiatPerGfi: number;
}

export function UnstakedFiduBanner({
  fiduBalance,
  sharePrice,
  estimatedApyFromGfiRaw,
  fiatPerGfi,
}: UnstakedFiduBannerProps) {
  const usdcValue = sharesToUsdc(fiduBalance.amount, sharePrice);
  const fiatApyFromGfi = computeApyFromGfiInFiat(
    estimatedApyFromGfiRaw,
    fiatPerGfi
  );
  return (
    <div>
      <div className="mb-2 text-lg font-medium">
        Stake your FIDU to earn additional GFI
      </div>
      <div className="mb-5">
        You have {formatCrypto(fiduBalance, { includeToken: true })} (
        {formatCrypto(usdcValue)}) that is not staked. Stake your FIDU to earn
        an additional {formatPercent(fiatApyFromGfi)} APY in GFI.
      </div>
      <Button
        as="a"
        className="block w-full"
        size="lg"
        variant="rounded"
        iconRight="ArrowSmRight"
        href="/stake"
      >
        Stake all FIDU
      </Button>
    </div>
  );
}
