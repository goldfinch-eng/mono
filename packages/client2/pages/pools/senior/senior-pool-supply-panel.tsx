import { gql } from "@apollo/client";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Icon,
  InfoIconTooltip,
  Link,
} from "@/components/design-system";
import { formatFiat, formatPercent } from "@/lib/format";
import {
  SeniorPoolSupplyPanelPoolFieldsFragment,
  SeniorPoolSupplyPanelUserFieldsFragment,
  SupportedFiat,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";

export const SENIOR_POOL_SUPPLY_PANEL_POOL_FIELDS = gql`
  fragment SeniorPoolSupplyPanelPoolFields on SeniorPool {
    latestPoolStatus {
      id
      estimatedApy
      estimatedApyFromGfiRaw
    }
  }
`;

export const SENIOR_POOL_SUPPLY_PANEL_USER_FIELDS = gql`
  fragment SeniorPoolSupplyPanelUserFields on User {
    id
    isUsEntity
    isNonUsEntity
    isUsAccreditedIndividual
    isUsNonAccreditedIndividual
    isNonUsIndividual
    isGoListed
  }
`;

interface SeniorPoolSupplyPanelProps {
  seniorPool: SeniorPoolSupplyPanelPoolFieldsFragment;
  user: SeniorPoolSupplyPanelUserFieldsFragment;
  fiatPerGfi: number;
}

export function SeniorPoolSupplyPanel({
  seniorPool,
  // user,
  fiatPerGfi,
}: SeniorPoolSupplyPanelProps) {
  const seniorPoolApyUsdc = seniorPool.latestPoolStatus.estimatedApy;
  const seniorPoolApyFromGfiFiat = computeApyFromGfiInFiat(
    seniorPool.latestPoolStatus.estimatedApyFromGfiRaw,
    fiatPerGfi
  );

  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useForm<{ supply: string; isStaking: string }>();
  const supplyValue = watch("supply");

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-sunrise-02 p-5 text-white md:flex-row xl:flex-col">
      <div
        data-id="top-half"
        className="flex flex-grow basis-0 flex-col items-start"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm">Est. APY</span>
          <InfoIconTooltip content="Placeholder: This APY includes the base USDC interest rate offered by the Senior Pool, as well as the GFI rewards from staking in the Senior Pool." />
        </div>
        <div className="mb-8 text-6xl">
          {formatPercent(seniorPoolApyUsdc.addUnsafe(seniorPoolApyFromGfiFiat))}
        </div>
        <table className="table-fixed border-collapse self-stretch text-left">
          <thead>
            <tr>
              <th scope="col" className="w-1/2 pb-3 font-normal">
                Est APY Breakdown
              </th>
              <th scope="col" className="w-1/2 pb-3 font-normal">
                <div className="flex items-center justify-end gap-2">
                  <span>Est Return</span>
                  <InfoIconTooltip content="Lorem ipsum" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="text-xl">
            <tr>
              <td className="border border-[#674C69] p-3">
                {formatPercent(seniorPoolApyUsdc)} APY
              </td>
              <td className="border border-[#674C69] p-3">
                <div className="flex items-center justify-end gap-2">
                  <span>
                    {formatFiat({
                      symbol: SupportedFiat.Usd,
                      amount: supplyValue
                        ? parseFloat(supplyValue) *
                          seniorPoolApyUsdc.toUnsafeFloat()
                        : 0,
                    })}
                  </span>
                  <Icon name="Usdc" aria-label="USDC logo" size="md" />
                </div>
              </td>
            </tr>
            <tr>
              <td className="border border-[#674C69] p-3">
                {formatPercent(seniorPoolApyFromGfiFiat)} APY
              </td>
              <td className="border border-[#674C69] p-3">
                <div className="flex items-center justify-end gap-2">
                  <span>
                    {formatFiat({
                      symbol: SupportedFiat.Usd,
                      amount: supplyValue
                        ? parseFloat(supplyValue) *
                          seniorPoolApyFromGfiFiat.toUnsafeFloat()
                        : 0,
                    })}
                  </span>
                  <Icon name="Gfi" aria-label="GFI logo" size="md" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <form
        data-id="bottom-half"
        className="flex flex-grow basis-0 flex-col justify-between"
      >
        <div>
          <DollarInput
            control={control}
            name="supply"
            label="Supply amount"
            colorScheme="dark"
            textSize="xl"
            labelClassName="!text-sm !mb-3"
            className="mb-4"
            errorMessage={errors?.supply?.message}
          />
          <Checkbox
            {...register("isStaking")}
            label={`Stake to earn GFI (${formatPercent(
              seniorPoolApyFromGfiFiat
            )})`}
            colorScheme="dark"
            className="mb-3"
          />
          {/* TODO senior pool agreement page */}
          <div className="mb-4 text-xs">
            By clicking “Supply” below, I hereby agree to the{" "}
            <Link href="/senior-pool-agreement">Senior Pool Agreement</Link>.
            Please note the protocol deducts a 0.50% fee upon withdrawal for
            protocol reserves.
          </div>
        </div>
        <Button
          className="block w-full"
          disabled={Object.keys(errors).length !== 0}
          size="xl"
          colorScheme="secondary"
          type="submit"
        >
          Supply
        </Button>
      </form>
    </div>
  );
}
