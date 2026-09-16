import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  defaultOpen?: boolean;
  hint?: string;
  children: ReactNode;
}

export default function Collapsible({ title, defaultOpen = false, hint, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible">
      <button type="button" className="collapsible-trigger" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg className={`chevron${open ? " open" : ""}`} viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path fill="currentColor" d="M7 5l6 5-6 5V5z" />
        </svg>
        <span>{title}</span>
        {hint && !open && <span className="collapsible-hint">{hint}</span>}
      </button>
      <div className={`collapsible-panel${open ? " open" : ""}`}>
        <div className="collapsible-panel-inner">{children}</div>
      </div>
    </div>
  );
}
