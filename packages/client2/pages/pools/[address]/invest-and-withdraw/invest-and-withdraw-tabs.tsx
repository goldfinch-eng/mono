import {
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupplyPanelDealFieldsFragment,
  SupplyPanelLoanFieldsFragment,
  SupplyPanelUserFieldsFragment,
  WithdrawalPanelLoanFieldsFragment,
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
  tranchedPool: SupplyPanelLoanFieldsFragment &
    WithdrawalPanelLoanFieldsFragment;
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
  return (
    <div>
      {didUserInvest ? (
        <div className="mb-6">
          <div className="mb-3 flex justify-between gap-5 text-sm">
            Total capital invested
          </div>
          <div className="text-3xl text-sand-800">
            {formatCrypto({
              token: "USDC",
              amount: sum("principalAmount", poolTokens),
            })}
          </div>
        </div>
      ) : null}
      <TabGroup>
        <TabList>
          <TabButton>Invest</TabButton>
          <TabButton disabled={!didUserInvest}>Withdraw</TabButton>
        </TabList>
        <TabPanels>
          <TabContent>
            <SupplyPanel loan={tranchedPool} user={user} deal={deal} />
          </TabContent>
          <TabContent>
            <WithdrawalPanel loan={tranchedPool} poolTokens={poolTokens} />
          </TabContent>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
