import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicComment } from "@/lib/serialize";

const MAX_COMMENT_LENGTH = 2000;

interface CommentBody {
  body: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { activityId: id },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  return NextResponse.json(comments.map(toPublicComment));
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

  let body: CommentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const trimmed = (body.body ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comment body must be ${MAX_COMMENT_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      activityId: id,
      userId: session.user.id,
      body: trimmed,
    },
    include: { user: true },
  });

  return NextResponse.json(toPublicComment(comment), { status: 201 });
}
