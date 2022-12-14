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
      <div className="mb-3 grid grid-cols-12 px-6 text-sand-500">
        <div className="col-span-6 block">{slot1Label}</div>
        <div className="col-span-3 hidden justify-self-end md:block">
          {slot2Label}
        </div>
        <div className="col-span-6 block justify-self-end md:col-span-3">
          {slot3Label}
        </div>
      </div>
      <div className="relative rounded-xl bg-sand-100 py-4 px-6 hover:bg-sand-200">
        <div className="grid grid-cols-12 items-center">
          <div className="col-span-6 block text-xl text-sand-700">{slot1}</div>
          <div className="hidden justify-self-end text-xl text-sand-700 md:col-span-3 md:block">
            {slot2}
          </div>
          <div className="col-span-6 block justify-self-end text-xl text-sand-700 md:col-span-3">
            {slot3}
          </div>
        </div>
      </div>
    </div>
  );
}
