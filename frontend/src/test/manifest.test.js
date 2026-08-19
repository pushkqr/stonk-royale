import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * These assertions are about files on disk, not about rendered components. A manifest that
 * names an icon it does not have, or an og:image given as a relative path, both fail
 * completely silently in a real browser — no console error, no broken image, just no
 * install prompt and no link preview. Disk is the only place that is checkable.
 */
const root = process.cwd();
const publicDir = resolve(root, "public");
const manifest = JSON.parse(readFileSync(resolve(publicDir, "manifest.json"), "utf-8"));
const html = readFileSync(resolve(root, "index.html"), "utf-8");

const publicFile = (src) => resolve(publicDir, src.replace(/^\//, ""));

describe("install and share metadata", () => {
  it("the manifest carries what a browser needs to offer an install prompt", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("every icon the manifest promises actually exists", () => {
    for (const icon of manifest.icons) {
      expect(existsSync(publicFile(icon.src))).toBe(true);
    }
  });

  it("index.html links the manifest and the iOS icon, and that icon exists", () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(existsSync(publicFile("/apple-touch-icon.png"))).toBe(true);
  });

  it("the share card is an absolute URL and the file is present", () => {
    const match = html.match(/property="og:image"\s+content="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/^https:\/\//);
    expect(existsSync(publicFile("/og-card.png"))).toBe(true);
  });
});
