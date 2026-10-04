import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const indexPath = join(root, "library/activities/index.json");
const scriptsPath = join(root, "library/assets/audio/voiceover-scripts.json");

describe("voiceover authoring data", () => {
  it("covers every indexed activity exactly once", () => {
    const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
      activities: Array<{ id: string }>;
    };

    expect(existsSync(scriptsPath)).toBe(true);
    if (!existsSync(scriptsPath)) return;

    const scripts = JSON.parse(readFileSync(scriptsPath, "utf8")) as {
      prompts: Record<string, string>;
      completionText: string;
    };
    const activityIds = index.activities.map(({ id }) => id).sort();

    expect(Object.keys(scripts.prompts).sort()).toEqual(activityIds);
    for (const id of activityIds) {
      expect(typeof scripts.prompts[id]).toBe("string");
      expect(scripts.prompts[id].trim().length).toBeGreaterThan(0);
    }
    expect(scripts.completionText).toBe("Well done!");
  });

  it("dry run validates scripts without invoking audio generation", () => {
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts/generate-voiceovers.mjs"), "--dry-run"],
      { cwd: root, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Validated 17 prompt scripts");
    expect(result.stdout).toContain("pilot-v1");
  });
});
