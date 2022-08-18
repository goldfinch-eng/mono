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
        "group flex items-center justify-between rounded-[10px] border border-sand-100 bg-white p-4 text-left shadow-sand-300 hover:border-sand-200 hover:shadow",
        className
      )}
    >
      {children}
      {selected ? (
        <Icon name="Checkmark" size="md" className="group-hover:!hidden" />
      ) : null}
      <Icon
        name="ArrowSmRight"
        size="sm"
        className="hidden group-hover:block"
      />
    </button>
  );
}
