import { CheckCheck } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <CheckCheck size={23} />
      </span>
      TaskFlow<span className="brand-dot">.</span>
    </span>
  );
}
