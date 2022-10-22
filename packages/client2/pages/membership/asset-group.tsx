import clsx from "clsx";
import { ReactNode } from "react";

import { Button, ButtonProps } from "@/components/design-system";

interface AssetGroupProps {
  className?: string;
  headingLeft: string;
  headingRight?: string;
  colorScheme?: "sand" | "gold";
  children: ReactNode;
}

export function AssetGroup({
  className,
  headingLeft,
  headingRight,
  colorScheme = "sand",
  children,
}: AssetGroupProps) {
  return (
    <div
      className={clsx(
        className,
        "rounded-xl border",
        colorScheme === "sand"
          ? "border-sand-200 bg-sand-100"
          : "border-mustard-200 bg-mustard-200"
      )}
    >
      <div className="flex items-center justify-between gap-8 p-5 text-lg font-medium">
        <div>{headingLeft}</div>
        <div>{headingRight}</div>
      </div>
      <hr
        className={clsx(
          "border-t",
          colorScheme === "sand" ? "border-sand-300" : "border-mustard-300"
        )}
      />
      <div className="p-5">{children}</div>
    </div>
  );
}

interface AssetGroupSubheadingProps {
  left: string;
  right?: string;
}

export function AssetGroupSubheading({
  left,
  right,
}: AssetGroupSubheadingProps) {
  return (
    <div className="mb-2 flex justify-between gap-4 text-sm">
      <div>{left}</div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

type AssetGroupButtonProps = Omit<ButtonProps, "size">;

export function AssetGroupButton({
  className,
  ...rest
}: AssetGroupButtonProps) {
  return <Button {...rest} size="xl" className={clsx(className, "w-full")} />;
}
