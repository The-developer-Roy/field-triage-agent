import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.TRELLO_API_KEY!;
    const token = process.env.TRELLO_TOKEN!;
    const listId = process.env.TRELLO_LIST_ID!;

    // First, get the board ID from one list (the one you already have)
    const listRes = await fetch(
      `https://api.trello.com/1/lists/${listId}?key=${key}&token=${token}`
    );
    if (!listRes.ok) throw new Error("Failed to fetch list info");
    const listData = await listRes.json();
    const boardId = listData.idBoard;

    // Fetch all lists in the board
    const listsRes = await fetch(
      `https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`
    );
    if (!listsRes.ok) throw new Error("Failed to fetch board lists");
    const lists = await listsRes.json();

    // Fetch all cards in the board (not just one list)
    const cardsRes = await fetch(
      `https://api.trello.com/1/boards/${boardId}/cards?attachments=true&key=${key}&token=${token}`
    );
    if (!cardsRes.ok) throw new Error("Failed to fetch Trello cards");
    const cards = await cardsRes.json();

    // Create a lookup for list names
    const listMap = new Map<string, string>();
    lists.forEach((list: any) => listMap.set(list.id, list.name));

    // Format all cards
    const formatted = cards.map((card: any) => ({
      id: card.id,
      name: card.name,
      desc: card.desc,
      url: card.url,
      idList: card.idList,
      listName: listMap.get(card.idList) || "Unknown",
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
