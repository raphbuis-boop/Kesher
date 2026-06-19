import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const maxDuration = 30;

// Action types
export type ComposeAction =
  | "draft"
  | "rewrite_professional"
  | "rewrite_warm"
  | "rewrite_shorter"
  | "sms"
  | "whatsapp"
  | "translate"
  | "subject_lines";

// Response shapes vary by action
const draftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

const bodyOnlySchema = z.object({
  body: z.string(),
});

const subjectLinesSchema = z.object({
  subjectLines: z.array(z.string()).min(3).max(6),
});

function buildSystemPrompt(audienceLabel: string): string {
  return `You are a communications assistant for a Jewish day school. You help administrators write clear, warm, and professional messages to the school community. The current audience is "${audienceLabel}". Write in plain text only — no markdown, no bullet symbols, no asterisks, no hashtags. Use line breaks between paragraphs.`;
}

function buildPrompt(
  action: ComposeAction,
  subject: string,
  body: string,
  customPrompt: string,
  audienceLabel: string
): string {
  switch (action) {
    case "draft":
      return `Write an email message for the following request: "${customPrompt}"\n\nGenerate a subject line and a complete message body.`;

    case "rewrite_professional":
      return `Rewrite the following email message in a more professional and formal tone. Keep the same meaning and all key details.\n\nSubject: ${subject}\n\nBody:\n${body}`;

    case "rewrite_warm":
      return `Rewrite the following email message in a warmer, more personal, and welcoming tone. Keep the same meaning and all key details.\n\nSubject: ${subject}\n\nBody:\n${body}`;

    case "rewrite_shorter":
      return `Rewrite the following email message to be significantly shorter and more concise. Keep all essential information but remove any redundancy.\n\nSubject: ${subject}\n\nBody:\n${body}`;

    case "sms":
      return `Convert the following email message into a brief SMS text message (under 160 characters if possible, maximum 320 characters). Keep only the most essential information and include a short call-to-action if needed.\n\nSubject: ${subject}\n\nBody:\n${body}`;

    case "whatsapp":
      return `Convert the following email message into a WhatsApp message. Use a friendly, conversational tone. Keep it concise but complete. You may use line breaks for readability. Do not use markdown formatting like bold or italics.\n\nSubject: ${subject}\n\nBody:\n${body}`;

    case "translate": {
      const isHebrew = /[\u0590-\u05FF]/.test(body);
      const direction = isHebrew
        ? "Translate the following from Hebrew to English"
        : "Translate the following from English to Hebrew";
      return `${direction}. Maintain the tone and formality of the original. Translate both subject and body.\n\nSubject: ${subject}\n\nBody:\n${body}`;
    }

    case "subject_lines":
      return `Generate 5 compelling subject line options for the following email message. Each should be distinct in tone or approach (e.g., informative, warm, urgent, concise, community-focused).\n\nBody:\n${body}`;

    default:
      return "";
  }
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file." },
      { status: 500 }
    );
  }

  let body: {
    action: ComposeAction;
    subject?: string;
    body?: string;
    prompt?: string;
    audienceLabel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { action, subject = "", body: msgBody = "", prompt = "", audienceLabel = "community" } = body;

  if (!action) {
    return Response.json({ error: "Action is required." }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(audienceLabel);
  const userPrompt = buildPrompt(action, subject, msgBody, prompt, audienceLabel);

  const model = openai("gpt-5.5");

  try {
    if (action === "draft" || action === "translate" || action === "rewrite_professional" || action === "rewrite_warm" || action === "rewrite_shorter") {
      const { output } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        output: Output.object({ schema: draftSchema }),
      });
      return Response.json({ type: "draft", ...output });
    }

    if (action === "sms" || action === "whatsapp") {
      const { output } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        output: Output.object({ schema: bodyOnlySchema }),
      });
      return Response.json({ type: "body", ...output });
    }

    if (action === "subject_lines") {
      const { output } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        output: Output.object({ schema: subjectLinesSchema }),
      });
      return Response.json({ type: "subject_lines", ...output });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("[ai-compose]", err);
    return Response.json(
      { error: err?.message ?? "AI generation failed. Please try again." },
      { status: 500 }
    );
  }
}
