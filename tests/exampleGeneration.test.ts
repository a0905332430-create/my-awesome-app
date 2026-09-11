import { afterEach, describe, expect, it, vi } from "vitest";
import { generateExampleSentence } from "../server/exampleGeneration";

describe("generateExampleSentence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a clean bilingual example from the ChatGPT response", async () => {
    process.env.OPENAI_API_KEY = "sk-test-example";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sentence: "She packed her luggage before sunrise.",
                  translation: "她在日出前收好了行李。",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await generateExampleSentence("luggage", "行李", "He lost his luggage yesterday.");

    expect(result).toEqual({
      sentence: "She packed her luggage before sunrise.",
      translation: "她在日出前收好了行李。",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "gpt-4o-mini",
      temperature: 0.95,
    });
  });
});
