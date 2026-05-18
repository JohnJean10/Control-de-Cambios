import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { systemPrompt, content, useVision } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    });

    let parts;
    if (typeof content === "string") {
      parts = [{ text: content }];
    } else {
      parts = content.map((item) => {
        if (item.type === "text") return { text: item.text };
        if (item.type === "image") return { inlineData: { mimeType: "image/jpeg", data: item.data } };
        return null;
      }).filter(Boolean);
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const text = result.response.text();

    res.status(200).json({ text });
  } catch (err) {
    console.error("Gemini API error:", err);
    const msg = err.message || "Unknown error";
    const status = msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
}
