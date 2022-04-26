import { Disclosure, Transition } from "@headlessui/react";
import clsx from "clsx";
import { ReactNode } from "react";

import { Icon } from "../icon";

interface BannerProps {
  /**
   * Class that will be placed on the wrapper of this banner. Use this for positioning purposes. By default this renders as `position: static`, which may not be desirable.
   */
  className?: string;
  /**
   * The content that appears in the banner's unexpanded state
   */
  initialContent: ReactNode;
  /**
   * The content that appears after the banner is expanded
   */
  expandedContent: ReactNode;
}

export function Banner({
  className,
  initialContent,
  expandedContent,
}: BannerProps) {
  return (
    <Disclosure as="div" className={clsx("w-full text-white", className)}>
      {({ open }) => (
        <>
          <Disclosure.Button className="flex w-full justify-between bg-sky-500 py-6 px-16">
            <div className={clsx(open ? "opacity-70" : null)}>
              {initialContent}
            </div>
            <Icon
              name="ChevronDown"
              size="md"
              className={clsx(
                "transition-transform duration-200",
                open ? "rotate-180" : null
              )}
            />
          </Disclosure.Button>
          <Transition
            enter="duration-200 transition origin-top"
            enterFrom="scale-y-0"
            enterTo="scale-y-100"
            leave="duration-200 transition origin-top"
            leaveFrom="scale-y-100"
            leaveTo="scale-y-0"
          >
            <Disclosure.Panel className="bg-sky-500 px-16 pb-6">
              <div
                className={clsx(
                  "transition duration-200",
                  open ? "opacity-100" : "opacity-0"
                )}
              >
                {expandedContent}
              </div>
            </Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  );
}
