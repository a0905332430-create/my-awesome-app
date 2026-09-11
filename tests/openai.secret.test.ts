import { describe, expect, it } from "vitest";

describe("OpenAI server secret", () => {
  it("can authenticate against the lightweight models endpoint", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toMatch(/^sk-/);

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(200);
  }, 30_000);
});
