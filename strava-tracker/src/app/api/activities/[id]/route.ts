import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManualActivityType } from "@/lib/constants";
import { parseDurationToSeconds } from "@/lib/units";
import { toPublicActivity } from "@/lib/serialize";

interface ManualActivityBody {
  type: string;
  title: string;
  distanceMiles: number | string;
  movingTime: string;
  elapsedTime: string;
  startDate: string;
}

function parseManualActivityBody(body: ManualActivityBody) {
  if (!isManualActivityType(body.type)) {
    throw new Error("Invalid activity type");
  }
  const title = (body.title ?? "").trim();
  if (!title) {
    throw new Error("Title is required");
  }
  const distanceMiles = Number(body.distanceMiles);
  if (!Number.isFinite(distanceMiles) || distanceMiles < 0) {
    throw new Error("Invalid distance");
  }
  const movingTimeSeconds = parseDurationToSeconds(String(body.movingTime));
  const elapsedTimeSeconds = parseDurationToSeconds(String(body.elapsedTime));
  const startDate = new Date(body.startDate);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date");
  }
  return { type: body.type, title, distanceMiles, movingTimeSeconds, elapsedTimeSeconds, startDate };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Strava-sourced activities are never editable through this form, and a
  // user may only edit manual entries they own.
  if (existing.source !== "manual" || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ManualActivityBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseManualActivityBody(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const activity = await prisma.activity.update({
    where: { id },
    data: parsed,
    include: { user: true },
  });

  return NextResponse.json(toPublicActivity(activity));
}
