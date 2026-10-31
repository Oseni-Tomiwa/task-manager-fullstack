import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ActionButton } from "../components/ActionButton";
it("dismisses action tooltips with Escape without invoking the action", async () => {
  const action = vi.fn();
  const user = userEvent.setup();
  render(
    <ActionButton label="Edit this task" tooltip="Edit task" onClick={action}>
      Edit
    </ActionButton>,
  );
  await user.tab();
  const button = screen.getByRole("button", { name: "Edit this task" });
  expect(button).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(button).toHaveClass("tooltip-dismissed");
  expect(action).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(action).toHaveBeenCalledOnce();
});
