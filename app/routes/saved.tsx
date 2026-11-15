import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/saved";
import { db } from "~/db";
import { requireStudent } from "~/lib/access.server";
import {
  getBookmarksForStudent,
  getNotesForStudent,
} from "~/lib/bookmarks-notes.server";
import { Card, CardContent } from "~/components/ui/card";
import { Bookmark, NotebookPen } from "lucide-react";
import { formatRelativeTime } from "~/lib/utils";

export function meta() {
  return [
    { title: "Saved — Cadence" },
    { name: "description", content: "Your bookmarks and notes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { userId } = await requireStudent(request);

  return {
    savedBookmarks: getBookmarksForStudent(db, userId),
    savedNotes: getNotesForStudent(db, userId),
  };
}

type LessonPlace = {
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  courseSlug: string;
};

function LessonLink({ place }: { place: LessonPlace }) {
  return (
    <>
      <Link
        to={`/courses/${place.courseSlug}/lessons/${place.lessonId}`}
        className="text-sm font-medium hover:underline"
      >
        {place.lessonTitle}
      </Link>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {place.courseTitle} · {place.moduleTitle}
      </p>
    </>
  );
}

function SavedSection({
  icon,
  title,
  emptyText,
  children,
}: {
  icon: ReactNode;
  title: string;
  emptyText: string;
  children: ReactNode[];
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

export default function Saved({ loaderData }: Route.ComponentProps) {
  const { savedBookmarks, savedNotes } = loaderData;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-sm text-muted-foreground">
          The lessons you bookmarked, and the notes you wrote on them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SavedSection
          icon={<Bookmark className="size-4 text-muted-foreground" />}
          title="Bookmarks"
          emptyText="No bookmarks yet."
        >
          {savedBookmarks.map((bookmark) => (
            <Card key={bookmark.id}>
              <CardContent className="py-3">
                <LessonLink place={bookmark} />
              </CardContent>
            </Card>
          ))}
        </SavedSection>

        <SavedSection
          icon={<NotebookPen className="size-4 text-muted-foreground" />}
          title="Notes"
          emptyText="No notes yet."
        >
          {savedNotes.map((note) => (
            <Card key={note.id}>
              <CardContent className="space-y-1 py-3">
                <LessonLink place={note} />
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                <p
                  suppressHydrationWarning
                  className="text-xs text-muted-foreground"
                >
                  Edited {formatRelativeTime(note.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </SavedSection>
      </div>
    </div>
  );
}
