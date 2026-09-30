import { describe, expect, it } from "vitest";
import { activityJsonCacheKey } from "../../runtime/src/scenes/activity-cache-key.js";

describe("activity JSON cache keys", () => {
  it("uses a distinct cache key for each activity ID", () => {
    expect(activityJsonCacheKey("act_kitchen_one_v1")).toBe("activity:act_kitchen_one_v1");
    expect(activityJsonCacheKey("act_kitchen_one_v1")).not.toBe(
      activityJsonCacheKey("act_kitchen_two_v1")
    );
  });
});
