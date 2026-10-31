import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, createApiClient } from "../api/client";
import type { RegisterInput, User } from "../api/contracts";

type Session = {
  phase: "restoring" | "ready" | "error";
  user: User | null;
  epoch: number;
  expired: boolean;
};
export function useSession() {
  const [session, setSession] = useState<Session>({
    phase: "restoring",
    user: null,
    epoch: 0,
    expired: false,
  });
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const initialApi = useMemo(() => createApiClient(), []);
  const transition = useCallback((user: User | null, expired = false) => {
    setSession((previous) => ({
      phase: "ready",
      user,
      epoch: previous.epoch + 1,
      expired,
    }));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void initialApi
      .me(controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted) transition(data.user);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) transition(null);
        else setSession((previous) => ({ ...previous, phase: "error" }));
      });
    return () => controller.abort();
  }, [attempt, initialApi, transition]);
  const onUnauthorized = useCallback(() => {
    setSession((previous) =>
      previous.epoch === session.epoch
        ? {
            phase: "ready",
            user: null,
            epoch: previous.epoch + 1,
            expired: true,
          }
        : previous,
    );
  }, [session.epoch]);
  const api = useMemo(
    () => createApiClient(undefined, undefined, onUnauthorized),
    [onUnauthorized],
  );
  async function signIn(values: RegisterInput, register: boolean) {
    if (pending.current)
      throw new Error(
        "An authentication request is already in progress. Please wait and try again.",
      );
    pending.current = true;
    try {
      const result = register
        ? await initialApi.register(values)
        : await initialApi.login({
            email: values.email,
            password: values.password,
          });
      transition(result.data.user);
    } finally {
      pending.current = false;
    }
  }
  async function logout() {
    if (pending.current)
      throw new Error(
        "An authentication request is already in progress. Please wait and try again.",
      );
    pending.current = true;
    try {
      await api.logout();
      transition(null);
    } finally {
      pending.current = false;
    }
  }
  function retry() {
    setSession((previous) => ({ ...previous, phase: "restoring" }));
    setAttempt((previous) => previous + 1);
  }
  return { ...session, api, signIn, logout, retry };
}
