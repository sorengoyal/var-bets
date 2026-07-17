import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const adapterUrl = process.env.ADMIN_DATA_URL ?? "http://localhost:4010";

export async function GET() {
  try {
    const response = await fetch(`${adapterUrl}/v1/admin/dashboard`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `DASHBOARD_ADAPTER_${response.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "DASHBOARD_ADAPTER_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
