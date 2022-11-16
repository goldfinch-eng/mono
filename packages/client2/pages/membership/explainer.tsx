import { ReactNode } from "react";

import { Drawer, DrawerProps } from "@/components/design-system";

type ExplainerProps = Omit<DrawerProps, "children" | "size" | "from">;

export function Explainer({ isOpen, onClose }: ExplainerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      from="right"
      size="sm"
      title="How does Membership work?"
    >
      <div className="space-y-4">
        <Section heading="Introduction to vaults">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
          <div className="mt-4 flex h-64 items-center justify-center border border-dashed border-black">
            Media goes here
          </div>
        </Section>
        <Section heading="How is the estimated protocol revenue earnings calculated?">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
          <div className="mt-4 flex h-64 items-center justify-center border border-dashed border-black">
            Media goes here
          </div>
        </Section>
      </div>
    </Drawer>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sand-200 bg-sand-100 p-5">
      <h3 className="mb-4 text-lg font-medium">{heading}</h3>
      <div>{children}</div>
    </div>
  );
}
