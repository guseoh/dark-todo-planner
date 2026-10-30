import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "info" | "success" | "warning" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ children, variant = "secondary", size = "md", loading = false,
  className = "", disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}>
      {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
