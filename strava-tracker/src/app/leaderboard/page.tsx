import { prisma } from "@/lib/prisma";
import { toPublicActivity, toPublicUser } from "@/lib/serialize";
import { getActivityCutoffDate } from "@/lib/cutoff";
import Header from "@/components/Header";
import LeaderboardClient from "@/components/LeaderboardClient";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const cutoffDate = getActivityCutoffDate();
  const [activityRows, userRows] = await Promise.all([
    prisma.activity.findMany({
      where: cutoffDate ? { startDate: { gte: cutoffDate } } : undefined,
      include: { user: true },
    }),
    prisma.user.findMany({ orderBy: { firstName: "asc" } }),
  ]);

  const activities = activityRows.map((a) => toPublicActivity(a));
  const users = userRows.map(toPublicUser);
  const timeZone = process.env.APP_TIMEZONE ?? "UTC";

  return (
    <>
      <Header />
      <LeaderboardClient activities={activities} users={users} timeZone={timeZone} />
    </>
  );
}
