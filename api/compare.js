import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { systemPrompt, content } = req.body;

    let formattedContent;
    if (typeof content === "string") {
      formattedContent = content;
    } else {
      // Array de {type: "text"|"image", text?: string, data?: base64}
      formattedContent = content.map((item) => {
        if (item.type === "text") return { type: "text", text: item.text };
        if (item.type === "image") return { 
          type: "image", 
          source: { 
            type: "base64", 
            media_type: "image/jpeg", 
            data: item.data 
          } 
        };
        return null;
      }).filter(Boolean);
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ 
        role: "user", 
        content: formattedContent 
      }]
    });

    const text = response.content.find(block => block.type === "text")?.text || "[]";
    res.status(200).json({ text });

  } catch (err) {
    console.error("Claude API error:", err);
    const msg = err.message || "Unknown error";
    
    // Humanizar errores de rate limit
    if (msg.includes("rate_limit") || msg.includes("exceeded_limit")) {
      const match = msg.match(/"resets_at":(\d+)/);
      if (match) {
        const resetDate = new Date(parseInt(match[1]) * 1000);
        const mins = Math.ceil((resetDate - new Date()) / 60000);
        const h = Math.floor(mins / 60), m = mins % 60;
        const timeStr = h > 0 ? `${h}h ${m}min` : `${m} minutos`;
        return res.status(429).json({ 
          error: `Límite de uso alcanzado. Se restablece en aproximadamente ${timeStr} (a las ${resetDate.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}).`
        });
      }
      return res.status(429).json({ error: "Límite de uso alcanzado. Intenta más tarde." });
    }

    const status = msg.includes("authentication") || msg.includes("API key") ? 401 : 500;
    res.status(status).json({ error: msg });
  }
}
