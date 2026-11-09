import { useState } from "react";

export function useLogout(
  logout: () => Promise<void>,
  setError: (message: string) => void,
  blocked = false,
) {
  const [loggingOut, setLoggingOut] = useState(false);
  const busy = blocked || loggingOut;

  async function signOut() {
    if (busy) return;
    setLoggingOut(true);
    setError("");
    try {
      await logout();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t log you out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return { busy, signOut };
}
