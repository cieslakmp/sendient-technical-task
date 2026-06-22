import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Progress Tracker</h1>
        <p className="mt-1 text-muted-foreground">
          A small app for tracking how students are progressing across topics
          and subjects.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/students">
          <Card className="hover:border-foreground/30">
            <CardTitle>Students</CardTitle>
            <CardSubtitle>
              View students and drill into their progress over time.
            </CardSubtitle>
          </Card>
        </Link>
        <Link href="/topics">
          <Card className="hover:border-foreground/30">
            <CardTitle>Topics</CardTitle>
            <CardSubtitle>Topics tracked across subjects.</CardSubtitle>
          </Card>
        </Link>
        <Link href="/progress/new">
          <Card className="hover:border-foreground/30">
            <CardTitle>Record progress</CardTitle>
            <CardSubtitle>
              Log a new score for a student on a topic.
            </CardSubtitle>
          </Card>
        </Link>
        <Link href="/insights">
          <Card className="hover:border-foreground/30">
            <CardTitle>Insights</CardTitle>
            <CardSubtitle>
              Cohort averages, score bands, and students needing attention.
            </CardSubtitle>
          </Card>
        </Link>
      </div>
    </div>
  );
}
