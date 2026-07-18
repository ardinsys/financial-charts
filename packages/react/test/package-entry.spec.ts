import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const distEntry = resolve(process.cwd(), "dist/index.js");

describe("package entry", () => {
  it.skipIf(!existsSync(distEntry))(
    'marks the built entry as a client module with "use client"',
    () => {
      // Without the directive, Next.js App Router users importing the
      // component from a Server Component get opaque hook errors.
      const firstLine = readFileSync(distEntry, "utf8")
        .trimStart()
        .split("\n", 1)[0];
      expect(firstLine).toMatch(/^["']use client["'];?$/);
    }
  );
});
