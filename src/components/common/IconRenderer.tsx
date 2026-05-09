import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckSquare,
  Code,
  Database,
  FileText,
  Folder,
  Github,
  Lightbulb,
  PenTool,
  Server,
  Settings,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { isCategoryImageIcon, normalizeCategoryIcon } from "../../lib/categoryIcon";

export const lucideIconMap = {
  BookOpen,
  CheckSquare,
  Code,
  FileText,
  Calendar,
  Lightbulb,
  Folder,
  Star,
  PenTool,
  Github,
  Database,
  Server,
  Settings,
  StickyNote,
} satisfies Record<string, LucideIcon>;

export type LucideIconName = keyof typeof lucideIconMap;

type IconRendererProps = {
  icon?: string | null;
  color?: string;
  name: string;
  className?: string;
  iconClassName?: string;
  fallback?: "dot" | "box";
};

const parseLucideIconName = (value: string): LucideIconName | null => {
  if (!value.startsWith("lucide:")) return null;
  const name = value.replace("lucide:", "");
  return name in lucideIconMap ? (name as LucideIconName) : null;
};

export function IconRenderer({
  icon,
  color = "#64748b",
  name,
  className = "",
  iconClassName = "",
  fallback = "dot",
}: IconRendererProps) {
  const [failed, setFailed] = useState(false);
  const normalizedIcon = normalizeCategoryIcon(icon);
  const lucideIconName = useMemo(() => (normalizedIcon ? parseLucideIconName(normalizedIcon) : null), [normalizedIcon]);

  useEffect(() => {
    setFailed(false);
  }, [normalizedIcon]);

  if (normalizedIcon && lucideIconName) {
    const Icon = lucideIconMap[lucideIconName];
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-950/60 ${className}`} aria-hidden="true">
        <Icon className={iconClassName || "h-4 w-4"} />
      </span>
    );
  }

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

  if (fallback === "box") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-950/60 ${className}`} aria-hidden="true">
        <Folder className={iconClassName || "h-4 w-4"} style={{ color }} />
      </span>
    );
  }

  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`} style={{ backgroundColor: color }} aria-hidden="true" />;
}
