import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { getAverageForStudent } from "@/lib/actions/server.actions";

export async function AverageScoreWidget({
  studentId,
}: {
  readonly studentId: number;
}) {
  const avg = await getAverageForStudent(studentId);
  return (
    <Card>
      <CardTitle>Average score</CardTitle>
      <CardSubtitle>Across all recorded topics</CardSubtitle>
      <p className="mt-2 text-3xl font-semibold">{avg !==null ? avg.toFixed(1) : "-"}</p>
    </Card>
  );
}
