import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/utils/cloudinary"; // <-- import your utility

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

    const key = process.env.TRELLO_API_KEY!;
    const token = process.env.TRELLO_TOKEN!;
    const listId = process.env.TRELLO_LIST_ID!;

    // --- Step 1: Create Trello card ---
    const title = `[Critical - Mechanical] ${report.slice(0, 40)}...`;
    const cardRes = await fetch(
      `https://api.trello.com/1/cards?idList=${listId}&key=${key}&token=${token}&name=${encodeURIComponent(
        title
      )}&desc=${encodeURIComponent(
        machineId ? `${report}\n\nMachine: ${machineId}` : report
      )}`,
      { method: "POST" }
    );

    const cardData = await cardRes.json();
    if (!cardRes.ok) {
      console.error("Trello Card Creation Error:", cardData);
      throw new Error("Failed to create Trello card");
    }

    const cardId = cardData.id;

    // --- Step 2: Upload photo to Cloudinary (if provided) ---
    if (photo) {
      const bytes = await photo.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Convert file to base64 for Cloudinary upload
      const base64String = `data:${photo.type};base64,${buffer.toString(
        "base64"
      )}`;

      const uploadResult = await uploadToCloudinary(base64String, "reports");

      if (uploadResult?.url) {
        // --- Step 3: Attach Cloudinary image to Trello card ---
        const attachRes = await fetch(
          `https://api.trello.com/1/cards/${cardId}/attachments?key=${key}&token=${token}&url=${encodeURIComponent(
            uploadResult.url
          )}`,
          {
            method: "POST",
          }
        );

        const attachData = await attachRes.json();
        if (!attachRes.ok) {
          console.error("Trello Attachment Error:", attachData);
        }
      }
    }

    // --- Step 4: Return success ---
    return NextResponse.json({
      success: true,
      message: "Report triaged and Trello card created successfully.",
      trelloUrl: cardData.url,
    });
  } catch (err: any) {
    console.error("Error in /api/triage:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
