import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { ApiError } from "../api/client";
import { Brand } from "../components/Brand";
import { FieldError } from "../components/FieldError";
import { validateCredentials } from "../validation";
import type { FieldErrors } from "../validation";
import type { RegisterInput } from "../api/contracts";

export function AuthPage({
  register,
  onSubmit,
}: {
  register: boolean;
  onSubmit: (values: RegisterInput, register: boolean) => Promise<void>;
}) {
  const pending = useRef(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "")
        .trim()
        .toLowerCase(),
      password: String(data.get("password") ?? ""),
    };
    const nextErrors = validateCredentials(values, register);
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) {
      form
        .querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)
        ?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await onSubmit(values, register);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const fields: FieldErrors = {};
        for (const key of ["name", "email", "password"] as const) {
          const message = error.fields[key]?.[0];
          if (typeof message === "string") fields[key] = message;
        }
        setErrors(fields);
      }
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t sign you in. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout" id="main-content">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="pill">A LITTLE CLARITY. A LOT OF PROGRESS.</span>
          <h1 tabIndex={-1}>
            Make room for
            <br />
            your best work.
          </h1>
          <p>
            Bring your tasks together, find your focus, and move forward. One
            small win at a time.
          </p>
          <div className="story-card">
            <span className="story-check">
              <Check size={22} />
            </span>
            <div>
              <strong>Progress feels good.</strong>
              <p>Your next great day starts with a plan.</p>
            </div>
            <span className="mini-bars">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
        <footer>
          Built for focus. Designed for you.<span>TaskFlow / 2026</span>
        </footer>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
          <h2 tabIndex={-1}>
            {register ? "A fresh start awaits." : "Welcome back."}
          </h2>
          <p className="muted">
            {register
              ? "Create your workspace and find your flow."
              : "A clear mind starts with a clear plan. Let’s get to it."}
          </p>
          <form onSubmit={submit} aria-busy={busy} noValidate>
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby="name-error"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="Your name"
                />
              </label>
            )}
            <FieldError id="name-error" message={errors.name} />
            <label>
              Email address
              <input
                name="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby="email-error"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <FieldError id="email-error" message={errors.email} />
            <label>
              Password
              <div className="password-wrap">
                <input
                  name="password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby="password-error password-help"
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <FieldError id="password-error" message={errors.password} />
            <small id="password-help">
              {register
                ? "Use at least 12 characters, up to 72 UTF-8 bytes."
                : "Sign in with your TaskFlow account."}
            </small>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to TaskFlow?"}{" "}
            <Link
              to={register ? "/login" : "/register"}
              aria-disabled={busy || undefined}
              onClick={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
