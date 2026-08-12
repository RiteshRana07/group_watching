import { NextResponse } from "next/server";

// Kept as a compatibility endpoint for older clients. A room's first video
// is immutable now; additional videos must go through the queue endpoint.
export async function PATCH() {
  return NextResponse.json(
    { error: "The room's original video cannot be replaced. Add the new video to the queue instead." },
    { status: 409 }
  );
}
