import { prisma } from "@/lib/prisma";
import { toPublicActivity, toPublicUser } from "@/lib/serialize";
import Header from "@/components/Header";
import LeaderboardClient from "@/components/LeaderboardClient";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [activityRows, userRows] = await Promise.all([
    prisma.activity.findMany({ include: { user: true } }),
    prisma.user.findMany({ orderBy: { firstName: "asc" } }),
  ]);

  const activities = activityRows.map(toPublicActivity);
  const users = userRows.map(toPublicUser);
  const timeZone = process.env.APP_TIMEZONE ?? "UTC";

  return (
    <>
      <Header />
      <LeaderboardClient activities={activities} users={users} timeZone={timeZone} />
    </>
  );
}
