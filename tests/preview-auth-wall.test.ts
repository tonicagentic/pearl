import assert from "node:assert/strict";
import { test } from "node:test";

import { detectAuthWall } from "../lib/coder/preview-screenshot.ts";

test("detectAuthWall flags Vercel login redirects", () => {
  assert.equal(
    detectAuthWall({
      url: "https://app.example.vercel.app",
      finalUrl: "https://vercel.com/login?next=%2F",
      httpStatus: 200,
    }),
    true,
  );
});

test("detectAuthWall flags 401 responses", () => {
  assert.equal(
    detectAuthWall({
      url: "https://app.example.vercel.app",
      httpStatus: 401,
    }),
    true,
  );
});

test("detectAuthWall leaves healthy public previews alone", () => {
  assert.equal(
    detectAuthWall({
      url: "https://public-portfolio.vercel.app",
      finalUrl: "https://public-portfolio.vercel.app/",
      httpStatus: 200,
      bodySnippet: "<html><body>Hello</body></html>",
    }),
    false,
  );
});
