import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-500",
  secondary: "bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-500",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

/** Shared button primitive used across the app. */
export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold " +
    "shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 " +
    "focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <button type={type} className={`${base} ${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
