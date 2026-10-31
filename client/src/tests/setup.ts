import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});
// jsdom has no native modal top layer; this shim only verifies component behavior.
// Native top-layer/inert behavior still requires a real browser walkthrough.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
