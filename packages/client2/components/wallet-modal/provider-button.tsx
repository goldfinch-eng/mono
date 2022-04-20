import { ButtonHTMLAttributes } from "react";

export function ProviderButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex items-center justify-between rounded-lg bg-sand-100 px-6 py-4 text-sm font-medium text-sand-700 hover:bg-sand-200 disabled:opacity-50"
    />
  );
}
