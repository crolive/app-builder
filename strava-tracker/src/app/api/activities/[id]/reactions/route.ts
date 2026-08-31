import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.reaction.create({
      data: {
        activityId: id,
        userId: session.user.id,
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.reaction.deleteMany({
    where: {
      activityId: id,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
