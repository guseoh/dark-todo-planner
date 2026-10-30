import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconTone = "neutral" | "info" | "success" | "warning" | "danger";
export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  label: string;
  children: ReactNode;
  tone?: IconTone;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
};

export function IconButton({ label, children, tone = "neutral", size = "md", selected = false,
  className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button {...props} type={type} aria-label={label}
      className={`ui-icon-button ui-icon-button--${tone} ui-icon-button--${size} ${selected ? "is-selected" : ""} ${className}`.trim()}>
      {children}
    </button>
  );
}
