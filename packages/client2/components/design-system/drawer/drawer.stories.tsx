import { Story, Meta } from "@storybook/react";
import { useState } from "react";

import { Button } from "@/components/design-system";

import { DrawerProps, Drawer } from "./index";

export default {
  component: Drawer,
  title: "Components/Drawer",
} as Meta;

export const DrawerStory: Story<DrawerProps> = (args) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setIsDrawerOpen(true)}>Open drawer</Button>
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        from={args.from}
        title={args.title}
        description={args.description}
        size={args.size}
      >
        I am the contents of this drawer
      </Drawer>
    </div>
  );
};

DrawerStory.args = {
  from: "left",
  size: "sm",
  title: "Heading goes here",
  description: "Optional drawer description",
};

DrawerStory.argTypes = {
  isOpen: {
    table: {
      disable: true,
    },
  },
  onClose: {
    table: {
      disable: true,
    },
  },
  children: {
    table: {
      disable: true,
    },
  },
};
