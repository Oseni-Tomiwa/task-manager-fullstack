import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ActionButton } from "./ActionButton";
import { Brand } from "./Brand";

export function WorkspaceHeader({
  name,
  busy,
  onLogout,
}: {
  name: string;
  busy: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Brand />
        <nav className="workspace-nav" aria-label="Workspace">
          <NavLink to="/dashboard" end>
            Dashboard
          </NavLink>
          <NavLink to="/profile" end>
            Profile
          </NavLink>
        </nav>
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {Array.from(name)[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="account-name">{name}</span>
          <ActionButton
            label="Log out"
            tooltip="Log out"
            onClick={onLogout}
            disabled={busy}
          >
            <LogOut size={18} />
          </ActionButton>
        </div>
      </div>
    </header>
  );
}
