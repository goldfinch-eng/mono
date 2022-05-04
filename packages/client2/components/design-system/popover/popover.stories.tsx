import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Button } from "../button";
import { Popover } from "./index";

export default { title: "Components/Popover" } as ComponentMeta<typeof Popover>;

export const PopoverStory: ComponentStory<typeof Popover> = () => {
  return (
    <Popover
      content={({ close }) => (
        <div>
          Here is some stuff
          <div>
            <Button onClick={close}>Close popover</Button>
          </div>
        </div>
      )}
    >
      <Button>Click me</Button>
    </Popover>
  );
};
