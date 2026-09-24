import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopNav } from "@/components/ui/top-nav";

describe("Design System UI Components", () => {
  describe("Button", () => {
    it("renders primary button with coral styling and rounded-md", () => {
      const html = renderToString(<Button variant="primary">Click me</Button>);
      expect(html).toContain("bg-primary");
      expect(html).toContain("text-on-primary");
      expect(html).toContain("rounded-md");
      expect(html).toContain("Click me");
    });

    it("renders secondary button with warm canvas and hairline border", () => {
      const html = renderToString(<Button variant="secondary">Cancel</Button>);
      expect(html).toContain("bg-canvas");
      expect(html).toContain("border-hairline");
      expect(html).toContain("text-ink");
    });

    it("renders secondary-on-dark button with dark elevated surface", () => {
      const html = renderToString(
        <Button variant="secondary-on-dark">Dark Action</Button>,
      );
      expect(html).toContain("bg-surface-dark-elevated");
      expect(html).toContain("text-on-dark");
    });
  });

  describe("Input", () => {
    it("renders text input with canvas background and hairline border", () => {
      const html = renderToString(
        <Input label="Email Address" placeholder="test@example.com" />,
      );
      expect(html).toContain("Email Address");
      expect(html).toContain("bg-canvas");
      expect(html).toContain("border-hairline");
      expect(html).toContain("focus:border-primary");
    });

    it("displays error message and error border when error prop is present", () => {
      const html = renderToString(
        <Input label="Password" error="Password required" />,
      );
      expect(html).toContain("border-error");
      expect(html).toContain("Password required");
    });
  });

  describe("Card", () => {
    it("renders feature card with surface-card background and 12px rounding", () => {
      const html = renderToString(
        <Card variant="feature" title="Feature Title">
          <p>Card content</p>
        </Card>,
      );
      expect(html).toContain("bg-surface-card");
      expect(html).toContain("rounded-lg");
      expect(html).toContain("Feature Title");
    });

    it("renders code-window card with dark surface and chrome bar", () => {
      const html = renderToString(
        <Card variant="code-window" title="config.json">
          <code>{"{}"}</code>
        </Card>,
      );
      expect(html).toContain("bg-surface-dark");
      expect(html).toContain("config.json");
      expect(html).toContain("font-mono");
    });
  });

  describe("Badge", () => {
    it("renders pill badge with surface-card background", () => {
      const html = renderToString(<Badge variant="pill">Category</Badge>);
      expect(html).toContain("bg-surface-card");
      expect(html).toContain("rounded-full");
    });

    it("renders coral badge with primary background and uppercase text", () => {
      const html = renderToString(<Badge variant="coral">New</Badge>);
      expect(html).toContain("bg-primary");
      expect(html).toContain("uppercase");
    });
  });

  describe("TopNav", () => {
    it("renders top navigation with brand title and radial mark", () => {
      const html = renderToString(<TopNav />);
      expect(html).toContain("Repo Backups");
      expect(html).toContain("h-16");
      expect(html).toContain("border-hairline");
    });
  });
});
