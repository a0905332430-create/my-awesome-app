type ExampleResult = {
  sentence: string;
  translation: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function callChat(messages: Array<{ role: "system" | "user"; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.95,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
  const payload = (await response.json()) as OpenAIChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
}

export async function generateWordTranslation(word: string) {
  const data = await callChat([
    {
      role: "system",
      content: "You provide one concise Traditional Chinese meaning for an English vocabulary word. Return JSON only with exactly one string field named translation. Do not include pronunciation, examples, or markdown.",
    },
    {
      role: "user",
      content: `English word: ${word.trim()}`,
    },
  ]);
  const translation = cleanText(data.translation, 500);
  if (!translation) throw new Error("OpenAI returned an incomplete translation");
  return translation;
}

export async function generateExampleSentence(
  word: string,
  translation: string,
  avoidSentence?: string,
): Promise<ExampleResult> {
  const nonce = Math.random().toString(36).slice(2, 10);
  const data = await callChat([
    {
      role: "system",
      content:
        "You create short, natural English example sentences for a language learner. Return JSON only with exactly two string fields: sentence and translation. The sentence must be beginner-friendly, 6 to 14 words, and use the target word exactly as provided. The translation must be Traditional Chinese. Do not include markdown, pronunciation, or extra fields.",
    },
    {
      role: "user",
      content: `Target word: ${word}\nTarget meaning: ${translation}\nVariation nonce: ${nonce}\nAvoid using this exact previous sentence if present: ${avoidSentence ?? "none"}\nCreate one fresh example that is different in wording from typical textbook examples.`,
    },
  ]);
  const sentence = cleanText(data.sentence, 220);
  const exampleTranslation = cleanText(data.translation, 220);
  if (!sentence || !exampleTranslation) throw new Error("OpenAI returned an incomplete example");
  return { sentence, translation: exampleTranslation };
}
