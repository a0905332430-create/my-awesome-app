import { describe, expect, it, vi } from "vitest";
import { generateWordTranslation } from "../server/exampleGeneration";

describe("cache-aware vocabulary generation", () => {
  it("parses a concise translation from the AI response", async () => {
    process.env.OPENAI_API_KEY = "sk-test-cache";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ translation: "蘋果" }) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(generateWordTranslation("apple")).resolves.toBe("蘋果");
    vi.restoreAllMocks();
  });
});
