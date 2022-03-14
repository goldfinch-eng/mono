import { Button } from "@/components/button";
import { Heading } from "@/components/typography";

export default function SeniorPoolPage() {
  return (
    <div>
      <Heading level={1} className="mb-4">
        Senior Pool
      </Heading>
      <div className="rounded bg-sand-100 p-6">
        <div className="flex flex-wrap gap-4">
          <div>Portfolio Balance</div>
          <div>Est. Annual Growth</div>
        </div>
        <hr className="my-4" />
        <div className="flex flex-wrap gap-4">
          <Button size="xl" className="grow" iconLeft="ArrowUp">
            Supply
          </Button>
          <Button size="xl" className="grow" iconLeft="ArrowDown">
            Withdraw
          </Button>
        </div>
      </div>
    </div>
  );
}
