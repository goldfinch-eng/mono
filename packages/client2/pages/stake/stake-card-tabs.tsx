import { Tab } from "@headlessui/react";
import clsx from "clsx";
import { Fragment } from "react";
import type { ReactNode } from "react";

interface TabProps {
  children: ReactNode;
}

export function StakeTabGroup({ children }: TabProps) {
  return (
    <div className="relative z-10">
      <Tab.Group>{children}</Tab.Group>
    </div>
  );
}

export function StakeTabContent({ children }: TabProps) {
  return (
    <Tab.Panel>
      <div className="relative z-10 pt-8">{children}</div>
    </Tab.Panel>
  );
}

export function StakeTabButton({ children }: TabProps) {
  return (
    <Tab as={Fragment}>
      {({ selected }) => (
        <button
          className={clsx(
            "mr-6 border-b-2 text-lg font-medium",
            selected ? "border-b-sand-700" : "border-transparent opacity-50"
          )}
        >
          {children}
        </button>
      )}
    </Tab>
  );
}
