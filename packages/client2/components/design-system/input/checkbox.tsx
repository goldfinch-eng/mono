import clsx from "clsx";
import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  labelDecoration?: ReactNode;
  labelClassName?: string;
  hideLabel?: boolean;
  id?: string;
  colorScheme?: "light" | "dark";
  inputSize?: "sm" | "md" | "lg";
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      labelDecoration,
      labelClassName,
      hideLabel = false,
      id,
      name,
      colorScheme = "light",
      className,
      inputSize = "sm",
      ...rest
    },
    ref
  ) {
    const _id = id ?? name;
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
            {...rest}
            id={_id}
            name={name}
            type="checkbox"
            ref={ref}
            className={clsx(
              "peer appearance-none rounded disabled:opacity-50",
              colorScheme === "light"
                ? "border border-sand-300 bg-white text-sand-700 checked:border-sand-700 checked:bg-sand-700 hover:bg-sand-100 hover:checked:bg-sand-600"
                : colorScheme === "dark"
                ? "border border-transparent bg-sky-900 text-white hover:bg-sky-800"
                : null,
              inputSize === "lg"
                ? "h-8 w-8"
                : inputSize === "md"
                ? "h-6 w-6"
                : "h-4 w-4"
            )}
          />
          <svg
            viewBox="0 0 8 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="pointer-events-none absolute top-1/2 left-1/2 hidden h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 peer-checked:block"
          >
            <path
              d="M7.70711 1.70711C8.09763 1.31658 8.09763 0.683417 7.70711 0.292893C7.31658 -0.0976311 6.68342 -0.0976311 6.29289 0.292893L3 3.58579L1.70711 2.29289C1.31658 1.90237 0.683417 1.90237 0.292893 2.29289C-0.0976311 2.68342 -0.0976311 3.31658 0.292893 3.70711L2.29289 5.70711C2.68342 6.09763 3.31658 6.09763 3.70711 5.70711L7.70711 1.70711Z"
              fill="white"
            />
          </svg>
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
