import { prisma } from "@/lib/prisma";
import { toPublicActivity, toPublicUser } from "@/lib/serialize";
import { getActivityCutoffDate } from "@/lib/cutoff";
import Header from "@/components/Header";
import ErrorBanner from "@/components/ErrorBanner";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cutoffDate = getActivityCutoffDate();
  const [{ error }, activityRows, userRows] = await Promise.all([
    searchParams,
    prisma.activity.findMany({
      where: cutoffDate ? { startDate: { gte: cutoffDate } } : undefined,
      orderBy: { startDate: "desc" },
      include: { user: true },
    }),
    prisma.user.findMany({ orderBy: { firstName: "asc" } }),
  ]);

  const activities = activityRows.map(toPublicActivity);
  const users = userRows.map(toPublicUser);

  return (
    <>
      <Header />
      {error && <ErrorBanner code={error} />}
      <DashboardClient activities={activities} users={users} />
    </>
  );
}
