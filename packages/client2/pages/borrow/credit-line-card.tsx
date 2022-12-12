import { ReactNode } from "react";

interface CreditLineCardProps {
  className?: string;
  slot1: ReactNode;
  slot1Label?: string;
  slot2: ReactNode;
  slot2Label?: string;
  slot3?: ReactNode;
  slot3Label?: string;
}

export function CreditLineCard({
  className,
  slot1,
  slot1Label,
  slot2,
  slot2Label,
  slot3,
  slot3Label,
}: CreditLineCardProps) {
  return (
    <div className={className}>
      <div className="mx-6 mb-3 hidden grid-cols-12 text-sand-500 xs:grid">
        <div className="col-span-6 hidden md:block">{slot1Label}</div>
        <div className="col-span-3 hidden justify-self-end md:block">
          {slot2Label}
        </div>
        <div className="col-span-3 hidden justify-self-end md:block">
          {slot3Label}
        </div>
      </div>
      <div className="relative rounded-xl bg-sand-100 py-4 px-6 hover:bg-sand-200">
        <div className="grid grid-cols-12 items-center">
          <div className="col-span-6 hidden text-xl text-sand-700 md:block">
            {slot1}
          </div>
          <div className="col-span-3 hidden justify-self-end text-xl text-sand-700 md:block">
            {slot2}
          </div>
          <div className="col-span-3 hidden justify-self-end text-xl text-sand-700 md:block">
            {slot3}
          </div>
        </div>
      </div>
    </div>
  );
}
