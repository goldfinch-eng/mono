import {
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupplyFormDealFieldsFragment,
  SupplyFormTranchedPoolFieldsFragment,
  SupplyFormUserFieldsFragment,
  WithdrawalFormPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";

import { SupplyForm } from "./supply-form";
import { WithdrawalForm } from "./withdrawal-form";

export {
  SUPPLY_FORM_TRANCHED_POOL_FIELDS,
  SUPPLY_FORM_DEAL_FIELDS,
  SUPPLY_FORM_USER_FIELDS,
} from "./supply-form";
export { WITHDRAWAL_FORM_POOL_TOKEN_FIELDS } from "./withdrawal-form";

interface Props {
  tranchedPool: SupplyFormTranchedPoolFieldsFragment;
  user: SupplyFormUserFieldsFragment | null;
  deal: SupplyFormDealFieldsFragment;
  poolTokens: WithdrawalFormPoolTokenFieldsFragment[];
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
              <SupplyForm tranchedPool={tranchedPool} user={user} deal={deal} />
            </TabContent>
            <TabContent>
              <WithdrawalForm
                tranchedPoolAddress={tranchedPool.id}
                poolTokens={poolTokens}
              />
            </TabContent>
          </TabPanels>
        </TabGroup>
      ) : (
        <SupplyForm tranchedPool={tranchedPool} user={user} deal={deal} />
      )}
    </div>
  );
}
