import clsx from "clsx";
import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

interface RadioButtonProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  labelClassName?: string;
  labelDecoration?: ReactNode;
  hideLabel?: boolean;
  id?: string;
  colorScheme?: "light" | "dark";
  inputSize?: "sm" | "md" | "lg";
  value: string;
  name: string;
}

export const RadioButton = forwardRef<HTMLInputElement, RadioButtonProps>(
  function RadioButton(
    {
      label,
      labelClassName,
      labelDecoration,
      hideLabel = false,
      id,
      inputSize = "sm",
      className,
      value,
      colorScheme = "light",
      ...rest
    }: RadioButtonProps,
    ref
  ) {
    const _id = id ?? value;
    return (
      <div
        className={clsx(
          "flex items-center",
          colorScheme === "light"
            ? "text-sand-700"
            : colorScheme === "dark"
            ? "text-white"
            : null,
          className
        )}
      >
        <div className="relative flex justify-center">
          <input
            ref={ref}
            id={_id}
            type="radio"
            className={clsx(
              "peer appearance-none rounded-full disabled:opacity-50",
              colorScheme === "light"
                ? "border border-sand-300 bg-white checked:border-sand-700 hover:bg-sand-100 checked:hover:border-sand-800"
                : colorScheme === "dark"
                ? "border border-sand-100 bg-sky-900 checked:border-sand-200 hover:bg-sky-800 checked:hover:border-sand-300"
                : null,
              inputSize === "lg"
                ? "h-8 w-8"
                : inputSize === "md"
                ? "h-6 w-6"
                : "h-4 w-4"
            )}
            value={value}
            {...rest}
          />
          <div
            className={clsx(
              "pointer-events-none absolute top-1/2 left-1/2 hidden h-1/2 w-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full peer-checked:block",
              colorScheme === "light"
                ? "bg-sand-700 peer-hover:bg-sand-800"
                : colorScheme === "dark"
                ? "bg-sand-200 peer-hover:bg-sand-300"
                : null
            )}
          />
        </div>
        <div
          className={clsx(
            "flex w-full items-center justify-between gap-1",
            hideLabel && "sr-only"
          )}
        >
          <label htmlFor={_id} className={clsx("ml-3", labelClassName)}>
            {label}
          </label>
          {labelDecoration}
        </div>
      </div>
    );
  }
);
