import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/utils/cloudinary";
import { Composio } from "@composio/core";
import { createParser } from "eventsource-parser";

type LLMResult = {
  severity: string;
  category: string;
  title: string;
};

// ---------------- Gemini Classification ----------------
async function classifyWithGemini(report: string): Promise<LLMResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
    headers: { "Content-Type": "application/json" },
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
    }
  } catch (e) {
    console.warn("Could not parse Gemini output:", e);
  }

  return parsed;
}

// ---------------- Tool Router MCP Implementation ----------------
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });

async function getMCPUrlForUser(userId: string): Promise<string> {
  const session = await composio.experimental.toolRouter.createSession(userId, {
    toolkits: [{ toolkit: "trello", authConfigId: "ac_VxgkrjVafQRL" }],
  });
  return session.url;
}

// Generic function to call any MCP tool (tools/call)
async function callMCPTool(
  mcpUrl: string,
  toolName: string,
  toolParams: Record<string, any>
): Promise<any> {
  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toolParams,
      },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`MCP tool call error: ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let result: any = null;
  let accumulatedData: any[] = [];

  const parser = createParser((event) => {
    if (event.type === "event") {
      const data = event.data;

      if (data === "[DONE]") {
        console.log("🏁 Stream finished");
        return;
      }

      try {
        const parsed = JSON.parse(data);
        console.log("📦 MCP Event:", JSON.stringify(parsed, null, 2));

        accumulatedData.push(parsed);

        // Extract result from various possible locations
        if (parsed.result) {
          result = parsed.result;
        } else if (parsed.content) {
          result = parsed.content;
        }

        if (parsed.error) {
          console.error("❌ MCP Error:", parsed.error);
          throw new Error(`MCP error: ${JSON.stringify(parsed.error)}`);
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.warn("⚠️ Could not parse chunk:", data.substring(0, 100));
        } else {
          throw e;
        }
      }
    }
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }

  if (!result && accumulatedData.length > 0) {
    console.log("⚠️ Returning last event as result");
    result =
      accumulatedData[accumulatedData.length - 1].result || accumulatedData;
  }

  if (!result) {
    throw new Error("MCP tool did not return a result");
  }

  return result;
}

// Step 1: Search for Trello tools
async function searchComposioTools(
  mcpUrl: string,
  useCase: string,
  knownFields: string
): Promise<any> {
  return await callMCPTool(mcpUrl, "COMPOSIO_SEARCH_TOOLS", {
    use_case: useCase,
    known_fields: knownFields,
    session: { generate_id: true },
  });
}

// Step 2: Execute Trello tool
async function executeComposioTool(
  mcpUrl: string,
  sessionId: string,
  toolSlug: string,
  toolArgs: Record<string, any>
): Promise<any> {
  return await callMCPTool(mcpUrl, "COMPOSIO_MULTI_EXECUTE_TOOL", {
    tools: [
      {
        tool_slug: toolSlug,
        arguments: toolArgs,
      },
    ],
    session_id: sessionId,
    sync_response_to_workbench: false,
    memory: {}, // Required by the schema
  });
}

// ---------------- API Handler ----------------
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const report = formData.get("report") as string;
    const photo = formData.get("photo") as File | null;
    const machineId = formData.get("machineId") as string | null;

    if (!report)
      return NextResponse.json(
        { success: false, message: "No report text provided" },
        { status: 400 }
      );

    // 1️⃣ Classify report via Gemini
    const llmData = await classifyWithGemini(report);
    console.log("LLM Classification:", llmData);

    // 2️⃣ Upload photo (if exists)
    let attachmentUrl: string | undefined;
    if (photo) {
      const bytes = await photo.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${photo.type};base64,${buffer.toString("base64")}`;
      const uploadRes = await uploadToCloudinary(base64, "reports");
      attachmentUrl = uploadRes?.url;
    }

    // 3️⃣ Create MCP URL
    const userId = "pg-test-072e1038-d48a-4910-aa33-29da217805f0";
    const mcpUrl = await getMCPUrlForUser(userId);
    console.log("🔗 MCP URL:", mcpUrl);

    // 4️⃣ Search for Trello create card tool
    console.log("🔍 Searching for Trello tools...");
    const searchResult = await searchComposioTools(
      mcpUrl,
      "create a card on trello",
      `list_id:${process.env.TRELLO_LIST_ID}`
    );

    console.log("✅ Search Result:", JSON.stringify(searchResult, null, 2));

    // Parse the search result - it comes in content[0].text as JSON string
    let parsedData: any;
    try {
      const textContent = searchResult?.content?.[0]?.text;
      if (textContent) {
        parsedData = JSON.parse(textContent);
      } else {
        throw new Error("No content found in search result");
      }
    } catch (e) {
      console.error("Failed to parse search result:", e);
      throw new Error("Invalid search result format");
    }

    const sessionId = parsedData?.data?.session?.id || "zero";
    const mainTools = parsedData?.data?.main_tools || [];
    const connectionStatuses = parsedData?.data?.connection_statuses || [];

    console.log("📋 Session ID:", sessionId);
    console.log(
      "🔧 Main Tools:",
      mainTools.map((t: any) => t.tool_slug)
    );

    // Check if Trello is connected
    const trelloConnection = connectionStatuses.find(
      (c: any) => c.toolkit === "trello"
    );
    if (!trelloConnection?.active_connection) {
      console.log(
        "⚠️ Trello not connected. Need to establish connection first."
      );

      // For now, throw an error - you'll need to handle OAuth separately
      throw new Error(
        "Trello connection not found. Please connect Trello in Composio dashboard first: " +
          "https://app.composio.dev/connections"
      );
    }

    // Find the Trello ADD_CARDS tool
    const trelloTool = mainTools.find(
      (t: any) => t.tool_slug === "TRELLO_ADD_CARDS"
    );

    if (!trelloTool) {
      throw new Error("TRELLO_ADD_CARDS tool not found in search results");
    }

    console.log("🎯 Found Trello Tool:", trelloTool.tool_slug);

    // 5️⃣ Execute Trello card creation
    const trelloArgs: Record<string, any> = {
      idList: process.env.TRELLO_LIST_ID!,
      name: `[${llmData.severity} - ${llmData.category}] ${llmData.title}`,
      desc: machineId ? `${report}\n\nMachine: ${machineId}` : report,
    };

    // According to the schema, attachments use 'urlSource' parameter
    if (attachmentUrl) {
      trelloArgs.urlSource = attachmentUrl;
    }

    console.log("🚀 Executing Trello card creation with args:", trelloArgs);
    const executeResult = await executeComposioTool(
      mcpUrl,
      sessionId,
      trelloTool.tool_slug,
      trelloArgs
    );

    console.log(
      "✅ Trello Card Created:",
      JSON.stringify(executeResult, null, 2)
    );

    return NextResponse.json({
      success: true,
      message: "Report triaged and Trello card created via Tool Router",
      llmData,
      searchResult,
      executeResult,
    });
  } catch (err: any) {
    console.error("❌ Error in /api/triage:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
