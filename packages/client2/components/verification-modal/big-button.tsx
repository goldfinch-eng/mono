import clsx from "clsx";

import { Icon } from "@/components/design-system";

interface BigButtonProps {
  className?: string;
  children: string;
  onClick?: () => void;
  selected?: boolean;
}

export function BigButton({
  className,
  children,
  onClick,
  selected,
}: BigButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center justify-between rounded-[10px] border border-sand-300 bg-white p-6 text-left hover:bg-sand-100",
        className
      )}
    >
      {children}
      {selected ? <Icon name="Checkmark" size="md" /> : null}
    </button>
  );
}
