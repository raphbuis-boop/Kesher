import { NextRequest, NextResponse } from "next/server";
import { countAudience, type FilterNode } from "@/lib/resolveAudience";

export async function POST(req: NextRequest) {
  try {
    const { filter } = await req.json();
    if (!filter) {
      return NextResponse.json({ count: 0 });
    }
    const count = await countAudience(filter as FilterNode);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
