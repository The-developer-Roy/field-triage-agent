import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/utils/cloudinary";

type LLMResult = {
  severity: string;
  category: string;
  title: string;
};

async function classifyWithGemini(report: string): Promise<LLMResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: `
You are a field maintenance assistant. Analyze the following report and respond ONLY with a valid JSON object containing:
{
  "severity": "Critical | Major | Minor",
  "category": "Mechanical | Electrical | Software | Other",
  "title": "Concise title (~40 characters)"
}

Report:
"""${report}"""
`,
          },
        ],
      },
    ],
  };

  const res = await fetch(`${url}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // Default fallback
  let parsed: LLMResult = {
    severity: "Minor",
    category: "General",
    title: report.slice(0, 40),
  };

  try {
    // ✅ Gemini returns text here
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    // ✅ Extract JSON safely even if Gemini adds extra text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      parsed = {
        severity: obj.severity ?? parsed.severity,
        category: obj.category ?? parsed.category,
        title: obj.title ?? parsed.title,
      };
    } else {
      console.warn("Gemini response not in JSON format:", rawText);
    }
  } catch (e) {
    console.warn(
      "Could not parse Gemini output JSON, using fallback:",
      e,
      data
    );
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const report = formData.get("report") as string;
    const photo = formData.get("photo") as File | null;
    const machineId = formData.get("machineId") as string | null;

    if (!report) {
      return NextResponse.json(
        { success: false, message: "No report text provided" },
        { status: 400 }
      );
    }

    // 1. Run classification via Gemini
    const llmData = await classifyWithGemini(report);
    console.log(llmData);

    const key = process.env.TRELLO_API_KEY!;
    const token = process.env.TRELLO_TOKEN!;
    const listId = process.env.TRELLO_LIST_ID!;

    // 2. Create Trello card title & description
    const title = `[${llmData.severity} - ${llmData.category}] ${llmData.title}`;
    const desc = machineId ? `${report}\n\nMachine: ${machineId}` : report;

    const cardRes = await fetch(
      `https://api.trello.com/1/cards?idList=${listId}&key=${key}&token=${token}&name=${encodeURIComponent(
        title
      )}&desc=${encodeURIComponent(desc)}`,
      { method: "POST" }
    );
    const cardData = await cardRes.json();
    if (!cardRes.ok) {
      console.error("Trello Card Creation Error:", cardData);
      throw new Error("Failed to create Trello card");
    }
    const cardId = cardData.id;

    // 3. If photo exists, upload and attach
    if (photo) {
      const bytes = await photo.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${photo.type};base64,${buffer.toString("base64")}`;
      const uploadRes = await uploadToCloudinary(base64, "reports");

      if (uploadRes?.url) {
        const attachRes = await fetch(
          `https://api.trello.com/1/cards/${cardId}/attachments?key=${key}&token=${token}&url=${encodeURIComponent(
            uploadRes.url
          )}`,
          { method: "POST" }
        );
        if (!attachRes.ok) {
          const attachData = await attachRes.json();
          console.error("Trello Attachment Error:", attachData);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Report triaged via Gemini and Trello card created.",
      trelloUrl: cardData.url,
      llmData,
    });
  } catch (err: any) {
    console.error("Error in /api/triage:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
