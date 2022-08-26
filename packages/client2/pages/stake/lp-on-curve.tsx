import { CryptoAmount } from "@/lib/graphql/generated";

import CurveCardCollapse from "./curve-card-collapse";
import LpCurveForm from "./lp-curve-form";

interface LpOnCurveProps {
  fiduBalance: CryptoAmount;
  usdcBalance: CryptoAmount;
  onComplete: () => void;
}

export default function LpOnCurve({
  fiduBalance,
  usdcBalance,
  onComplete,
}: LpOnCurveProps) {
  return (
    <>
      <div className="mb-3 grid grid-cols-11 items-center px-6 text-sand-500">
        <div className="col-span-6">Token to stake</div>
        <div className="col-span-2 text-right">Est. APY</div>
        <div className="col-span-2 text-right">Available to deposit</div>
      </div>

      <div className="mb-3">
        <CurveCardCollapse
          heading="Deposit FIDU"
          subheading="via Curve FIDU-USDC pool"
          apy={0}
          available={fiduBalance}
          image={"FIDU"}
        >
          <LpCurveForm
            balance={fiduBalance}
            type="FIDU"
            onComplete={onComplete}
          />
        </CurveCardCollapse>
      </div>

      <div>
        <CurveCardCollapse
          heading="Deposit USDC"
          subheading="via Curve FIDU-USDC pool"
          apy={0}
          available={usdcBalance}
          image={"USDC"}
        >
          <LpCurveForm
            balance={usdcBalance}
            type="USDC"
            onComplete={onComplete}
          />
        </CurveCardCollapse>
      </div>
    </>
  );
}
