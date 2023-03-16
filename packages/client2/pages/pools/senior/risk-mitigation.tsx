import { Button, Icon } from "@/components/design-system";
import { RiskTable } from "@/pages/pools/senior/risk-table";

export function RiskMitigation() {
  return (
    <div>
      <div className="mb-5 rounded-xl border border-sand-300 p-5 pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="pr-4 md:w-1/2">
            <div className="mb-3 text-sm text-sand-600">
              Senior Pool capital risk
            </div>
            <div className="mb-3 text-xs">
              Senior Pool capital is diversified across various borrower pools,
              and has the first lien on the assets across these pools. In return
              for this Seniority, it gives a portion of nominal interest to the
              junior investors who participate in the individual borrower pools
              as a “risk premium.”
            </div>
            <div className="mb-3 text-xs">
              Capital from these pools is used to finance real-world private
              debt transactions. USDC is converted to fiat by the Borrowers and
              used off-chain to finance economic activity, thus protected from
              on-chain DeFi volatility.
            </div>
            <div className="mb-6 text-xs">
              There is a ~15% overcollateralization for all deals funded by the
              Senior pool. Additionally, all Senior Pool capital lent to
              Borrowers are structured as Senior Secured - this means Senior
              Pool investors get paid back first before any other lenders.
            </div>
            <Button
              as="a"
              colorScheme="sand"
              variant="rounded"
              iconRight="ArrowTopRight"
              className="mr-1.5"
              target="_blank"
              rel="noopener"
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/liquidityproviders"
            >
              Read more
            </Button>
          </div>
          <div className="md:w-1/2">
            <div className="flex items-center rounded-lg border border-sand-300 p-2">
              <div className="w-3/5 space-y-1">
                <div className="flex h-[7rem] flex-col rounded-lg border border-twilight-400 bg-twilight-700 py-2 px-3 text-sand-50">
                  <div className="text-sm">Senior Tranche</div>
                </div>
                <div className="mb-1 flex flex-col rounded-lg bg-mustard-600 py-2 px-3 text-sand-50">
                  <div className="text-sm">Junior Tranche</div>
                </div>
              </div>
              <div className="flex w-2/5 justify-center pl-3 text-xs font-medium text-sand-500">
                <div className="max-w-[6rem] text-center">
                  Borrower Pool Principal Value
                </div>
              </div>
            </div>
            <div className="ml-2 w-[calc(100%_-_theme(space.4))]">
              <div className="mt-1.5 w-3/5 rounded-lg border border-mustard-200 bg-mustard-100 py-2 px-3 font-medium text-black">
                <div className="relative text-sm">
                  Additional Collateral
                  <div className="absolute -right-[8rem] -bottom-7 text-xs">
                    <Icon
                      name="ArrowUp"
                      className="absolute bottom-3 -left-1.5"
                      size="xs"
                    />
                    ~15% overcollateralization
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <RiskTable />
    </div>
  );
}
