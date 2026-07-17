import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const adapterUrl = process.env.ADMIN_DATA_URL ?? "http://localhost:4010";

export async function POST() {
  try {
    const response = await fetch(`${adapterUrl}/v1/simulation/reset`, {
      method: "POST",
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `SIMULATION_RESET_${response.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "SIMULATION_ADAPTER_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
