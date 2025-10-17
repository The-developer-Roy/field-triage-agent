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

  let parsed: LLMResult = {
    severity: "Minor",
    category: "General",
    title: report.slice(0, 40),
  };

  try {
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
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

// ---------------- Composio helper ----------------
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY!;

async function executeComposioTool(
  toolSlug: string,
  inputArgs: Record<string, any>,
  userId: string
) {
  // Use the documented endpoint:
  const url = `https://backend.composio.dev/api/v3/tools/execute/${toolSlug}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.COMPOSIO_API_KEY!,
    },
    body: JSON.stringify({
      user_id: userId,
      arguments: inputArgs,
      // or you could use `text` instead of `arguments` for natural-language requests
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Composio execute error: ${resp.status} ${txt}`);
  }

  const data = await resp.json();
  return data;
}

// ---------------- API Handler ----------------
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

    // 1️⃣ Classify report via Gemini
    const llmData = await classifyWithGemini(report);
    console.log("LLM Classification:", llmData);

    // 2️⃣ Prepare input for Composio (Trello workflow)
    const trelloInput: any = {
      idList: process.env.TRELLO_LIST_ID!,
      name: `[${llmData.severity} - ${llmData.category}] ${llmData.title}`,
      desc: machineId ? `${report}\n\nMachine: ${machineId}` : report,
    };

    // 4️⃣ Send to Composio (tool: "trello")
    const composioResult = await executeComposioTool(
      "TRELLO_CARD_CREATE_AND_UPDATE",
      trelloInput,
      "pg-test-072e1038-d48a-4910-aa33-29da217805f0"
    );
    console.log("Composio Result:", composioResult);

    const cardId = composioResult?.data?.id || composioResult?.id;

    // 3️⃣ If photo exists, upload to Cloudinary first
    if (photo) {
      const bytes = await photo.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${photo.type};base64,${buffer.toString("base64")}`;
      const uploadRes = await uploadToCloudinary(base64, "reports");
      if(uploadRes?.url){
        const attachResult = await executeComposioTool(
          "TRELLO_ADD_CARDS_ATTACHMENTS_BY_ID_CARD",
          {
            idCard: cardId,
            url: uploadRes.url,
            name: "Attached Photo",
          },
          "pg-test-072e1038-d48a-4910-aa33-29da217805f0"
        );
        console.log("Attachment Result: ", attachResult);
      }
    }
    return NextResponse.json({
      success: true,
      message:
        "Report triaged via Gemini and Trello card created via Composio.",
      llmData,
      composioResult,
    });
  } catch (err: any) {
    console.error("Error in /api/triage:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
