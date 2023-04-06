import { ButtonHTMLAttributes } from "react";

export function ProviderButton({
  errorMessage,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { errorMessage?: string }) {
  return (
    <div>
      <button
        {...rest}
        className="flex w-full items-center justify-between rounded-lg bg-sand-100 px-6 py-4 text-sm font-medium text-sand-700 hover:bg-sand-200 disabled:opacity-50"
      />
      {errorMessage ? (
        <div className="mt-1 ml-6 text-sm text-clay-500">{errorMessage}</div>
      ) : null}
    </div>
  );
}
