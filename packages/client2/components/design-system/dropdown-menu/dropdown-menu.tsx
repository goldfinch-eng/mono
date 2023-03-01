import { Menu, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment } from "react";

import { Icon } from "@/components/design-system/icon";

type Option<T extends string | number> = {
  value: T;
  label: string;
};

interface DropdownMenuProps<T extends string | number> {
  options: Option<T>[];
  selectedOption: Option<T>;
  onSelect: (option: Option<T>) => void;
}

export function DropdownMenu<T extends string | number>({
  options,
  selectedOption,
  onSelect,
}: DropdownMenuProps<T>) {
  return (
    <Menu as="div" className="relative">
      <div>
        <Menu.Button className="flex w-full items-center justify-center text-sm">
          {selectedOption.label}
          <Icon
            aria-hidden="true"
            name="ChevronDown"
            size="md"
            className="ml-1.5"
          />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 min-w-max origin-top-right rounded-md border border-sand-100 bg-white drop-shadow-lg">
          <div className="py-1">
            {options.map((option) => (
              <Menu.Item key={option.value}>
                {({ active }) => (
                  <button
                    className={clsx(
                      active ? "bg-sand-100 text-sand-900" : "text-sand-700",
                      "block w-full px-4 py-2 text-left text-sm"
                    )}
                    onClick={() => onSelect(option)}
                  >
                    {option.label}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

export default DropdownMenu;
