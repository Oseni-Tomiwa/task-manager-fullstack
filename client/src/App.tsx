import { useEffect } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { useSession } from "./auth/useSession";
import type { RegisterInput } from "./api/contracts";
import "./styles.css";

export default function App() {
  const {
    user,
    phase,
    epoch,
    expired,
    api,
    signIn: authenticate,
    logout,
    retry,
  } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    document.title = `TaskFlow — ${location.pathname === "/dashboard" ? "Your workspace" : location.pathname === "/register" ? "Create an account" : "Sign in"}`;
    const heading =
      document.querySelector<HTMLElement>(".auth-form h2") ??
      document.querySelector<HTMLElement>("h1");
    heading?.focus();
  }, [location.pathname, phase, user?.id]);
  async function signIn(values: RegisterInput, register: boolean) {
    await authenticate(values, register);
    navigate("/dashboard", { replace: true });
  }
  if (phase !== "ready")
    return (
      <main className="state-panel" id="main-content">
        {phase === "restoring" ? (
          <p role="status">Restoring your session…</p>
        ) : (
          <>
            <p role="alert">
              We couldn’t restore your session. Please try again.
            </p>
            <button className="primary" onClick={retry}>
              Try again
            </button>
          </>
        )}
      </main>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {expired && !user && (
        <p className="error session-notice" role="alert">
          Your session has expired. Please sign in again.
        </p>
      )}
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage key="login" register={false} onSubmit={signIn} />
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage key="register" register onSubmit={signIn} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard
                key={`${user.id}:${epoch}`}
                api={api}
                name={user.name}
                logout={logout}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </>
  );
}
