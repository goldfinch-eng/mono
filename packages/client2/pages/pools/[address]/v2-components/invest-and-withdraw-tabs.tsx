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
  SupplyPanelTranchedPoolFieldsFragment,
  SupplyPanelUserFieldsFragment,
  WithdrawalPanelPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";

import { SupplyPanel } from "./supply-panel";
import { WithdrawalPanel } from "./withdrawal-form";

export {
  SUPPLY_PANEL_TRANCHED_POOL_FIELDS,
  SUPPLY_PANEL_DEAL_FIELDS,
  SUPPLY_PANEL_USER_FIELDS,
} from "./supply-panel";
export { WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS } from "./withdrawal-form";

interface Props {
  tranchedPool: SupplyPanelTranchedPoolFieldsFragment;
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
          <div className="font-serif text-5xl font-semibold">
            {formatCrypto({
              token: "USDC",
              amount: sum("principalAmount", poolTokens),
            })}
          </div>
        </div>
      ) : null}
      {didUserInvest ? (
        <TabGroup>
          <TabList>
            <TabButton>Invest</TabButton>
            <TabButton>Withdraw</TabButton>
          </TabList>
          <TabPanels>
            <TabContent>
              <SupplyPanel
                tranchedPool={tranchedPool}
                user={user}
                deal={deal}
              />
            </TabContent>
            <TabContent>
              <WithdrawalPanel
                tranchedPoolAddress={tranchedPool.id}
                poolTokens={poolTokens}
              />
            </TabContent>
          </TabPanels>
        </TabGroup>
      ) : (
        <SupplyPanel tranchedPool={tranchedPool} user={user} deal={deal} />
      )}
    </div>
  );
}
