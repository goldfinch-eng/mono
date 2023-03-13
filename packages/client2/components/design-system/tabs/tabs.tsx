import { Tab } from "@headlessui/react";
import clsx from "clsx";
import { Fragment } from "react";
import type { ReactNode } from "react";

interface TabProps {
  children: ReactNode;
}

export function TabButton({ children }: TabProps) {
  return (
    <Tab as={Fragment}>
      {({ selected }) => (
        <button
          className={clsx(
            "-mb-px border-b-2 p-2.5 text-sand-900",
            selected ? "border-mustard-500 font-medium" : "border-transparent"
          )}
        >
          {children}
        </button>
      )}
    </Tab>
  );
}

export function TabContent({
  children,
  className,
}: TabProps & { className?: string }) {
  return <Tab.Panel className={clsx("pt-8", className)}>{children}</Tab.Panel>;
}

export function TabGroup(
  props: TabProps & { selectedIndex?: number; onChange?: (n: number) => void }
) {
  return <Tab.Group {...props} />;
}

export function TabList({ children }: TabProps) {
  return (
    <Tab.List>
      <div className="flex gap-2 border-b border-mustard-100">{children}</div>
    </Tab.List>
  );
}

export function TabPanels({ children }: TabProps) {
  return <Tab.Panels>{children}</Tab.Panels>;
}
