import { useState } from "react";
import type { ReactNode } from "react";
export function ActionButton({
  label,
  tooltip,
  onClick,
  children,
  destructive = false,
  disabled = false,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <button
      disabled={disabled}
      type="button"
      className={`icon-button action-button${destructive ? " delete-button" : ""}${dismissed ? " tooltip-dismissed" : ""}`}
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDismissed(true);
          e.stopPropagation();
        }
      }}
    >
      {children}
      <span className="action-tooltip" aria-hidden="true">
        {tooltip}
      </span>
    </button>
  );
}
