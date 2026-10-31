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
import { usePreviewSession } from "./preview/workspace";
import type { RegisterInput } from "./api/contracts";
import "./styles.css";

export default function App() {
  // Phase 4.2 replaces this presentation session with /auth/me and auth context.
  const { user, signIn: previewLogin, logout } = usePreviewSession();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    document.title = `TaskFlow — ${location.pathname === "/dashboard" ? "Your workspace" : location.pathname === "/register" ? "Create an account" : "Sign in"}`;
    const heading =
      document.querySelector<HTMLElement>(".auth-form h2") ??
      document.querySelector<HTMLElement>("h1");
    heading?.focus();
  }, [location.pathname]);
  async function signIn(values: RegisterInput, register: boolean) {
    await previewLogin(values, register);
    navigate("/dashboard" + location.search);
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="demo-banner">
        Phase 4.1 preview{" "}
        <span>
          Mock session and tasks — changes reset on reload. Backend integration
          follows in Phase 4.2. Use made-up credentials.
        </span>
      </div>
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
                name={user}
                logout={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              />
            ) : (
              <Navigate to={`/login${location.search}`} replace />
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
