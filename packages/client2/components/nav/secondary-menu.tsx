import { Popover, Icon } from "@/components/design-system";

import { SECONDARY_MENU_ITEMS } from "./nav-items";

export function SecondaryMenu() {
  return (
    <Popover placement="bottom-end" content={() => <SecondaryMenuContent />}>
      <button className="flex self-center rounded-full bg-sand-100 p-2 text-sand-700 hover:bg-sand-200 hover:text-sand-900 active:bg-sand-300 active:text-sand-900">
        <Icon name="Dots" />
      </button>
    </Popover>
  );
}

function SecondaryMenuContent() {
  return (
    <div className="-my-2">
      {SECONDARY_MENU_ITEMS.map((item) => (
        <a
          href={item.href}
          key={`secondary-menu-${item.label}`}
          className="flex items-center justify-between py-2 text-sm font-medium hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          <span className="mr-4">{item.label}</span>

          <Icon name="ArrowSmRight" size="md" className="text-sand-300" />
        </a>
      ))}
    </div>
  );
}
