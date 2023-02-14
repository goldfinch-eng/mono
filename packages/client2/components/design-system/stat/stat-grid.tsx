import clsx from "clsx";
import { ReactNode, Children, createContext, useContext } from "react";

import { InfoIconTooltip, Shimmer } from "@/components/design-system";

interface StatGridProps {
  children: ReactNode;
  className?: string;
  bgColor?: "white" | "mustard-50";
  borderColor?: "sand-200" | "sand-300";
  size?: "md" | "lg";
}

const StatGridContext = createContext<
  Omit<StatGridProps, "children" | "className">
>({});

/**
 * Honestly the layout that this component gives you is only good for the senior pool/borrower pool pages, so beware.
 */
export function StatGrid({
  children,
  className,
  bgColor = "white",
  borderColor = "sand-200",
  size = "md",
}: StatGridProps) {
  const numChildren = Children.count(children);
  const isRowsOfFour = numChildren % 4 === 0;

  return (
    <div
      className={clsx(
        className,
        "grid gap-px overflow-hidden rounded-xl border",
        borderColor === "sand-200"
          ? "border-sand-200 bg-sand-200"
          : borderColor === "sand-300"
          ? "border-sand-300 bg-sand-300"
          : null,
        isRowsOfFour
          ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-3"
      )}
    >
      <StatGridContext.Provider value={{ bgColor, borderColor, size }}>
        {children}
      </StatGridContext.Provider>
    </div>
  );
}

interface StatProps {
  /**
   * The label of the stat to display
   */
  label: string;

  /**
   * The content of the stat to display. If not provided, a <Shimmer /> component will be rendered to indicate it is loading.
   */
  value?: ReactNode;

  /**
   * Optional tooltip to display with an info icon
   */
  tooltip?: ReactNode;
}

/**
 * This component is not meant for use outside of being a direct child of <StatGrid>
 */
export function Stat({ label, value, tooltip }: StatProps) {
  const { bgColor, size } = useContext(StatGridContext);
  return (
    <div
      className={clsx(
        "flex flex-col justify-between",
        size === "lg" ? "px-10 py-6" : size === "md" ? "p-4" : null,
        bgColor === "white"
          ? "bg-white"
          : bgColor === "mustard-50"
          ? "bg-mustard-50"
          : null
      )}
    >
      <div className="mb-3 flex items-center text-sm text-sand-600">
        <span className={clsx(tooltip ? "mr-2" : null)}>{label}</span>
        {tooltip && <InfoIconTooltip size="sm" content={tooltip} />}
      </div>
      <div
        className={clsx(
          "font-medium text-sand-700",
          size === "md"
            ? "text-xl md:text-2xl"
            : size === "lg"
            ? "text-2xl sm:text-3xl"
            : null
        )}
      >
        {value ?? <Shimmer style={{ width: "10ch" }} />}
      </div>
    </div>
  );
}
