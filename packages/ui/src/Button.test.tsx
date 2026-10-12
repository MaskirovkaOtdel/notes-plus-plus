import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("calls onClick when pressed", () => {
    let clicked = 0;
    render(<Button onClick={() => (clicked += 1)}>Go</Button>);
    screen.getByRole("button").click();
    expect(clicked).toBe(1);
  });

  it("is disabled when disabled prop set", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
