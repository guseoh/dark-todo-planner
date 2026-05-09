import { useEffect, useState } from "react";
import { isCategoryImageIcon, normalizeCategoryIcon } from "../../lib/categoryIcon";

type CategoryIconProps = {
  icon?: string | null;
  color?: string;
  name: string;
  className?: string;
};

export function CategoryIcon({ icon, color = "#64748b", name, className = "" }: CategoryIconProps) {
  const [failed, setFailed] = useState(false);
  const normalizedIcon = normalizeCategoryIcon(icon);

  useEffect(() => {
    setFailed(false);
  }, [normalizedIcon]);

  if (normalizedIcon && isCategoryImageIcon(normalizedIcon) && !failed) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink-700 bg-ink-950/60 ${className}`}>
        <img
          src={normalizedIcon}
          alt={`${name} 아이콘`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  if (normalizedIcon && !isCategoryImageIcon(normalizedIcon)) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-950/60 text-sm ${className}`} aria-hidden="true">
        {Array.from(normalizedIcon).slice(0, 3).join("")}
      </span>
    );
  }

  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`} style={{ backgroundColor: color }} aria-hidden="true" />;
}
