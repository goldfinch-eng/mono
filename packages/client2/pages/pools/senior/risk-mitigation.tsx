import { Button, Icon } from "@/components/design-system";
import { RiskTable } from "@/pages/pools/senior/risk-table";

export function RiskMitigation() {
  return (
    <div>
      <div className="mb-5 rounded-xl border border-sand-300 p-5">
        <div className="flex items-center">
          <div className="w-[50%] pr-3">
            <div className="mb-3 text-sm text-sand-600">
              Senior Pool capital risk
            </div>
            <div className="mb-3 text-xs">
              Senior Pool capital has the first lien on assets. It gives 20% of
              nominal interest to the Junior Tranche&apos;s Backers as a “risk
              premium.”
            </div>
            <div className="mb-3 text-xs">
              An on-chain credit line finances real-world private debt deals.
              USDC is transferred off-chain to the Borrower to finance economic
              activity, protected from on-chain DeFi volatility.
            </div>
            <div className="mb-6 text-xs">
              For all Goldfinch debt deals, Goldfinch capital sits within the
              Senior Secured deals off-chain.
            </div>
            <Button
              as="a"
              colorScheme="sand"
              variant="rounded"
              iconRight="ArrowTopRight"
              className="mr-1.5"
              target="_blank"
              rel="noopener"
              // TODO ZADRA
              href="https://google.ca"
            >
              Read more
            </Button>
          </div>
          <div className="w-[50%]">
            <div className="ml-2 w-[calc(100%_-_theme(space.4))]">
              <div className="relative mb-1.5 w-[60%] rounded-lg border border-[#DBCCA6] bg-[#FEF4DA] py-2 px-3 font-medium text-black">
                <div className="absolute -right-32 -top-5 text-xs">
                  <Icon
                    name="ArrowDown"
                    className="absolute top-3 -left-1"
                    size="xs"
                  />
                  ~15% overcollateralization
                </div>
                <div className="text-sm">Additional Collateral</div>
              </div>
            </div>

            <div className="flex items-center rounded-lg border border-[#C8C4B9] p-2">
              <div className="w-[60%]">
                <div className="mb-1 flex h-[20%] flex-col rounded-lg bg-[#A1894B] py-2 px-3 text-[#FAF5E7]">
                  <div className="text-sm">Junior Tranche</div>
                  <div className="text-xs">20% of Borrower Pool</div>
                </div>
                <div className="flex h-[7rem] flex-col rounded-lg border border-[#919BB7] bg-[#303543] py-2 px-3 text-[#FAF5E7]">
                  <div className="text-sm">Senior Tranche</div>
                  <div className="text-xs">80% of Borrower Pool</div>
                </div>
              </div>
              <div className="flex w-[40%] justify-center pl-3 text-xs font-medium text-sand-500">
                <div className="max-w-[8rem] text-center">
                  Borrower Pool Principal Value
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
