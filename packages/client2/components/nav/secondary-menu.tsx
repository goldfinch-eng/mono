import { Popover, Icon, IconButton } from "@/components/design-system";

import { SECONDARY_MENU_ITEMS } from "./nav-items";

export function SecondaryMenu() {
  return (
    <Popover placement="bottom-end" content={() => <SecondaryMenuContent />}>
      <IconButton
        icon="DotsHorizontal"
        label="More links"
        variant="rounded"
        size="sm"
        colorScheme="light-mustard"
      />
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
