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
            "mr-1 -mb-px rounded-t-md border py-4 px-5 text-sm font-medium",
            selected
              ? "border-sand-200 border-b-white bg-white text-sand-900"
              : "border-transparent !border-b-sand-200 bg-sand-100 text-sand-600"
          )}
        >
          {children}
        </button>
      )}
    </Tab>
  );
}

export function TabContent({ children }: TabProps) {
  return (
    <Tab.Panel>
      <div className="pt-12">{children}</div>
    </Tab.Panel>
  );
}

export function TabGroup({ children }: TabProps) {
  return <Tab.Group>{children}</Tab.Group>;
}

export function TabList({ children }: TabProps) {
  return (
    <Tab.List>
      <div className="border-b border-sand-200">{children}</div>
    </Tab.List>
  );
}

export function TabPanels({ children }: TabProps) {
  return <Tab.Panels>{children}</Tab.Panels>;
}
