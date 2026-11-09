import { useState } from "react";
import type { User } from "../api/contracts";
import { useLogout } from "../auth/useLogout";
import { WorkspaceHeader } from "../components/WorkspaceHeader";

export function Profile({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const { busy, signOut } = useLogout(logout, setError);
  const name = user.name?.trim();
  const email = user.email?.trim();
  const joined = new Date(user.createdAt ?? "");

  return (
    <div className="app-shell">
      <WorkspaceHeader
        name={name || "Your account"}
        busy={busy}
        onLogout={() => void signOut()}
      />
      <main className="dashboard profile" id="main-content" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <div className="eyebrow">PERSONAL WORKSPACE</div>
            <h1 tabIndex={-1}>Profile</h1>
            <p className="muted">View your TaskFlow account information.</p>
          </div>
        </div>
        {error && (
          <p className="error profile-error" role="alert">
            {error}
          </p>
        )}
        <div className="profile-grid">
          <section className="profile-card" aria-labelledby="profile-personal">
            <h2 id="profile-personal">Personal information</h2>
            {name && (
              <div className="profile-identity">
                <span className="avatar" aria-hidden="true">
                  {name
                    .split(/\s+/u)
                    .slice(0, 2)
                    .map((part) => Array.from(part)[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <strong>{name}</strong>
              </div>
            )}
            <dl>
              <dt>Display name</dt>
              <dd>{name || "Unavailable"}</dd>
              <dt>Email address</dt>
              <dd>{email || "Unavailable"}</dd>
            </dl>
            <p className="muted profile-hint">
              Your email address is used to sign in.
            </p>
          </section>
          <section className="profile-card" aria-labelledby="profile-details">
            <h2 id="profile-details">Account details</h2>
            <dl>
              <dt>Member since</dt>
              <dd>
                {Number.isNaN(joined.getTime()) ? (
                  "Unavailable"
                ) : (
                  <time dateTime={user.createdAt}>
                    {joined.toLocaleDateString(undefined, {
                      dateStyle: "long",
                      timeZone: "UTC",
                    })}
                  </time>
                )}
              </dd>
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
