import { ComponentStory, ComponentMeta } from "@storybook/react";
import { useState } from "react";

import { DropdownMenu } from "./index";

export default {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
} as ComponentMeta<typeof DropdownMenu>;

export const DropdownMenuStory: ComponentStory<typeof DropdownMenu> = () => {
  const options = [
    { value: "CA", label: "Canada" },
    { value: "US", label: "USA" },
  ];
  const [selectedOption, setSelectedOption] = useState(options[0]);

  return (
    <div className="flex">
      <div className="mr-10 flex flex-col align-baseline">
        <div>Selected label: {selectedOption.label}</div>
        <div>Selected value: {selectedOption.value}</div>
      </div>
      <DropdownMenu
        options={options}
        selectedOption={selectedOption}
        onSelect={(option) => setSelectedOption(option)}
      />
    </div>
  );
};
