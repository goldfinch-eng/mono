import { useState } from "react";

import { Button, Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupplyPanelDealFieldsFragment,
  SupplyPanelLoanFieldsFragment,
  SupplyPanelUserFieldsFragment,
  WithdrawalPanelPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";

import { SupplyPanel } from "./supply-panel";
import { WithdrawalPanel } from "./withdrawal-form";

export {
  SUPPLY_PANEL_LOAN_FIELDS,
  SUPPLY_PANEL_DEAL_FIELDS,
  SUPPLY_PANEL_USER_FIELDS,
} from "./supply-panel";
export { WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS } from "./withdrawal-form";

interface Props {
  tranchedPool: SupplyPanelLoanFieldsFragment;
  user: SupplyPanelUserFieldsFragment | null;
  deal: SupplyPanelDealFieldsFragment;
  poolTokens: WithdrawalPanelPoolTokenFieldsFragment[];
}

export function InvestAndWithdrawTabs({
  tranchedPool,
  user,
  deal,
  poolTokens,
}: Props) {
  const totalUserCapitalInvested = sum("principalAmount", poolTokens);
  const didUserInvest =
    totalUserCapitalInvested !== null && !totalUserCapitalInvested.isZero();
  const [shownPanel, setShownPanel] = useState<"invest" | "withdraw" | null>(
    null
  );
  return (
    <div>
      {didUserInvest ? (
        <div className="mb-6">
          <div className="mb-3 flex justify-between gap-5 text-sm">
            Total capital invested
          </div>
          <div className="font-serif text-5xl font-semibold">
            {formatCrypto({
              token: "USDC",
              amount: sum("principalAmount", poolTokens),
            })}
          </div>
        </div>
      ) : null}
      {didUserInvest ? (
        shownPanel === null ? (
          <div className="flex flex-col items-stretch gap-3">
            <Button
              size="xl"
              colorScheme="mustard"
              onClick={() => setShownPanel("invest")}
            >
              Invest
            </Button>
            <Button
              size="xl"
              colorScheme="transparent-mustard"
              onClick={() => setShownPanel("withdraw")}
            >
              Withdraw
            </Button>
          </div>
        ) : (
          <div>
            <button
              className="mb-6 flex items-center gap-2 text-2xl"
              onClick={() => setShownPanel(null)}
            >
              <Icon name="ArrowLeft" />
              {shownPanel === "invest" ? "Invest" : "Withdraw"}
            </button>
            {shownPanel === "invest" ? (
              <SupplyPanel loan={tranchedPool} user={user} deal={deal} />
            ) : shownPanel === "withdraw" ? (
              <WithdrawalPanel
                tranchedPoolAddress={tranchedPool.id}
                poolTokens={poolTokens}
              />
            ) : null}
          </div>
        )
      ) : (
        <SupplyPanel loan={tranchedPool} user={user} deal={deal} />
      )}
    </div>
  );
}
