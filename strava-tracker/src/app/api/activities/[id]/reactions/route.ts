import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, ReactionEmoji } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REACTION_EMOJI_ORDER } from "@/lib/constants";

interface ReactionBody {
  emoji: string;
}

function isValidEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJI_ORDER as string[]).includes(value);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: ReactionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.emoji || !isValidEmoji(body.emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  try {
    await prisma.reaction.create({
      data: {
        activityId: id,
        userId: session.user.id,
        emoji: body.emoji,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    throw err;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: ReactionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.emoji || !isValidEmoji(body.emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  await prisma.reaction.deleteMany({
    where: {
      activityId: id,
      userId: session.user.id,
      emoji: body.emoji,
    },
  });

  return NextResponse.json({ success: true });
}
