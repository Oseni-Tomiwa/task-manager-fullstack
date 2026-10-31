import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useSession } from "../auth/useSession";
import { deferred, httpFixture, json, testUser } from "./httpFixture";
let http: ReturnType<typeof httpFixture>;
beforeEach(() => {
  http = httpFixture();
});
it("rejects overlapping authentication instead of reporting a request that was never sent as successful", async () => {
  const login = deferred<Response>();
  http.state.override = (path) =>
    path === "/api/auth/login" ? login.promise : undefined;
  const { result } = renderHook(() => useSession());
  await waitFor(() => expect(result.current.phase).toBe("ready"));
  let first!: Promise<void>;
  act(() => {
    first = result.current.signIn(
      { name: "", email: testUser.email, password: "TaskflowDemo!2026" },
      false,
    );
  });
  await expect(
    result.current.signIn(
      {
        name: "Other",
        email: "other@example.com",
        password: "Other password 123!",
      },
      true,
    ),
  ).rejects.toThrow(/in progress/);
  await act(async () => {
    login.resolve(json({ data: { user: testUser } }));
    await first;
  });
  expect(result.current.user?.id).toBe(testUser.id);
});
it("allows retry after network failure during session restoration", async () => {
  http.state.override = (path) => {
    if (path === "/api/auth/me") throw new TypeError("network");
    return undefined;
  };
  const { result } = renderHook(() => useSession());
  await waitFor(() => expect(result.current.phase).toBe("error"));
  http.state.override = undefined;
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.phase).toBe("ready"));
  expect(result.current.user).toBeNull();
});
