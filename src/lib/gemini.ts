import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export const hasGemini = () => Boolean(apiKey);

const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function embed(texts: string[]): Promise<number[][]> {
  if (!client) throw new Error("GEMINI_API_KEY not set");
  const model = client.getGenerativeModel({ model: "gemini-embedding-2-preview" });
  const out: number[][] = [];
  for (const t of texts) {
    const r = await model.embedContent(t);
    out.push(r.embedding.values);
  }
  return out;
}

export async function generate(prompt: string, system?: string): Promise<string> {
  if (!client) throw new Error("GEMINI_API_KEY not set");
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    systemInstruction: system,
  });
  const r = await model.generateContent(prompt);
  return r.response.text();
}
