import { Listbox, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment, ReactNode } from "react";
import { useController, UseControllerProps } from "react-hook-form";

import { HelperText, Icon } from "@/components/design-system";

export interface Option {
  value: string;
  label: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SelectProps extends UseControllerProps<any> {
  options: Option[];
  /**
   * Label text that will appear above the input
   */
  label: ReactNode;
  /**
   * Visually hide the label. Screen readers will still read it.
   */
  hideLabel?: boolean;
  /**
   * Placeholder shown in the selection when the user has not selected anything and there is no defaultValue (as determined by React Hook Fork) set.
   */
  placeholder?: string;
  /**
   * The `name` attribute of the input element. This is important to the functionality of standard HTML forms.
   */
  name: string;
  /**
   * Helper text that will appear below the input.
   */
  helperText?: string;
  /**
   * Error message that replaces the `helperText` when supplied
   */
  errorMessage?: string;
  disabled?: boolean;
  colorScheme?: "light" | "dark";
  textSize?: "sm" | "md" | "lg" | "xl";
  /**
   * This class goes on the wrapper of the whole component. Use this for positioning
   */
  className?: string;
  /**
   * Class that goes specifically on the label element, not on the wrapper. Makes it easier to override label-specific styles.
   */
  labelClassName?: string;
  /**
   * An element that will render on the right side of the label. Can be used to add extra contextual information like a tooltip.
   */
  labelDecoration?: ReactNode;
}

export function Select({
  options,
  label,
  hideLabel = false,
  placeholder = "Make a selection...",
  helperText,
  errorMessage,
  disabled = false,
  colorScheme = "light",
  textSize = "md",
  className,
  labelClassName,
  labelDecoration,
  ...controlProps
}: SelectProps) {
  const isError = !!errorMessage;
  const { field } = useController(controlProps);
  const selectedOption = options.find((o) => o.value === field.value) ?? null;
  return (
    <div
      className={clsx(
        "flex flex-col items-start justify-start",
        colorScheme === "light"
          ? "text-sand-700"
          : colorScheme === "dark"
          ? "text-white"
          : null,
        textSize === "sm"
          ? "text-sm"
          : textSize === "lg"
          ? "text-lg"
          : textSize === "xl"
          ? "text-2xl"
          : null,
        className
      )}
    >
      <Listbox
        value={selectedOption}
        onChange={(selected: Option | null) => field.onChange(selected?.value)}
        as="div"
        className="relative self-stretch"
      >
        <div
          className={clsx(
            "mb-1.5 flex w-full items-center justify-between gap-4 leading-none",
            hideLabel && "sr-only",
            labelClassName
          )}
        >
          <Listbox.Label>{label}</Listbox.Label>
          {labelDecoration ? labelDecoration : null}
        </div>
        <Listbox.Button
          disabled={disabled}
          className={clsx(
            "unfocused flex w-full items-center justify-between rounded", // unfocused because the color schemes supply a border color as a focus style
            colorScheme === "light"
              ? [
                  "border bg-white focus:border-sand-600",
                  isError
                    ? "border-clay-100 placeholder:text-clay-700"
                    : "border-sand-200 placeholder:text-sand-500",
                ]
              : colorScheme === "dark"
              ? [
                  "border bg-sky-900 focus:border-white",
                  isError
                    ? "border-clay-500 placeholder:text-clay-500"
                    : "border-transparent placeholder:text-sand-300",
                ]
              : null,
            disabled && "opacity-50",
            textSize === "sm"
              ? "py-1.5 px-3"
              : textSize === "md"
              ? "py-2 px-3"
              : textSize === "lg"
              ? "px-4 py-3"
              : textSize === "xl"
              ? "px-5 py-4"
              : null
          )}
        >
          <span
            className={clsx(
              "max-w-[90%] truncate",
              !selectedOption ? "opacity-50" : null
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          <Icon name="ChevronDown" />
        </Listbox.Button>

        <Transition
          as={Fragment}
          enterFrom="opacity-0 scale-95"
          enterTo="transition opacity-100 scale-100"
          leaveFrom="opacity-100 scale-100"
          leaveTo="transition opacity-0 scale-95"
        >
          <Listbox.Options
            className={clsx(
              "absolute z-10 mt-0.5 min-w-full origin-top rounded border drop-shadow-lg",
              colorScheme === "light"
                ? "border-sand-200 bg-white"
                : colorScheme === "dark"
                ? "border-white bg-sky-900"
                : null
            )}
          >
            {options.map((option: Option) => (
              <Listbox.Option
                key={option.value}
                value={option}
                className={clsx(
                  "cursor-pointer px-3 py-1.5 first:rounded-t first:pt-3 last:rounded-b last:pb-3",
                  colorScheme === "light"
                    ? "hover:bg-sand-200"
                    : colorScheme === "dark"
                    ? "hover:bg-sky-700"
                    : null
                )}
              >
                {option.label}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>

      {helperText || errorMessage ? (
        <HelperText
          className={clsx(
            isError
              ? "text-clay-500"
              : colorScheme === "light"
              ? "text-sand-400"
              : colorScheme === "dark"
              ? "text-sand-300"
              : null,
            "mt-1 text-sm leading-none"
          )}
        >
          {errorMessage ? errorMessage : helperText}
        </HelperText>
      ) : null}
    </div>
  );
}
