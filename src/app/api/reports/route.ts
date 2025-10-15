import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.TRELLO_API_KEY!;
    const token = process.env.TRELLO_TOKEN!;
    const listId = process.env.TRELLO_LIST_ID!;

    // Fetch all cards from the list
    const res = await fetch(
      `https://api.trello.com/1/lists/${listId}/cards?attachments=true&key=${key}&token=${token}`
    );

    if (!res.ok) throw new Error("Failed to fetch Trello cards");

    const cards = await res.json();

    // Simplify the data
    const formatted = cards.map((card: any) => ({
      id: card.id,
      name: card.name,
      desc: card.desc,
      url: card.url,
      attachments: card.attachments?.map((a: any) => a.url) || [],
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error("Error fetching reports:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
