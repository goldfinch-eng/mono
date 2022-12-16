import { ReactNode } from "react";

interface CreditLineCardProps {
  className?: string;
  description: ReactNode;
  nextPayment: ReactNode;
  dueDateLabel: ReactNode;
}

export function CreditLineCard({
  className,
  description,
  nextPayment,
  dueDateLabel,
}: CreditLineCardProps) {
  return (
    <div className={className}>
      <div className="relative rounded-xl bg-sand-100 py-4 px-6 hover:bg-sand-200">
        <div className="grid grid-cols-12 items-center">
          <div className="col-span-6 block text-xl text-sand-700">
            {description}
          </div>
          <div className="hidden justify-self-end text-xl text-sand-700 md:col-span-3 md:block">
            {nextPayment}
          </div>
          <div className="col-span-6 block justify-self-end text-xl text-sand-700 md:col-span-3">
            {dueDateLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
