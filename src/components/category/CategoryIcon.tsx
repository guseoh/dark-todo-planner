import { IconRenderer } from "../common/IconRenderer";

type CategoryIconProps = {
  icon?: string | null;
  color?: string;
  name: string;
  className?: string;
};

export function CategoryIcon({ icon, color = "#64748b", name, className = "" }: CategoryIconProps) {
  return <IconRenderer icon={icon} color={color} name={name} className={className} />;
}
