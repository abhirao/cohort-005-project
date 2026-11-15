import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { MAX_NOTE_LENGTH } from "./bookmarks-notes";
import {
  getBookmarksForStudent,
  getNote,
  getNotesForStudent,
  isBookmarked,
  saveNote,
  toggleBookmark,
} from "./bookmarks-notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 7, 12, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let otherLessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;

  otherLessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 2", position: 2 })
    .returning()
    .get().id;
});

describe("bookmarking a lesson", () => {
  it("adds a Bookmark, then removes it on the second toggle", () => {
    expect(toggleBookmark(db, base.user.id, lessonId)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonId)).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonId)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonId)).toBe(false);
  });

  it("keeps each Student's Bookmarks separate", () => {
    toggleBookmark(db, base.user.id, lessonId);

    expect(isBookmarked(db, base.instructor.id, lessonId)).toBe(false);
    expect(getBookmarksForStudent(db, base.instructor.id)).toEqual([]);
  });
});

describe("saving a note", () => {
  it("creates the Note with the body trimmed", () => {
    const note = saveNote(db, base.user.id, lessonId, "  remember this  ", NOW);

    expect(note).toMatchObject({
      body: "remember this",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it("updates the one Note per Lesson instead of adding a second", () => {
    saveNote(db, base.user.id, lessonId, "first", NOW);
    saveNote(db, base.user.id, lessonId, "second", LATER);

    const rows = db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.userId, base.user.id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      body: "second",
      createdAt: NOW.toISOString(),
      updatedAt: LATER.toISOString(),
    });
  });

  it("deletes the Note when the body is cleared", () => {
    saveNote(db, base.user.id, lessonId, "first", NOW);

    expect(saveNote(db, base.user.id, lessonId, "   ", LATER)).toBeNull();
    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });

  it(`refuses a body over ${MAX_NOTE_LENGTH} characters`, () => {
    expect(() =>
      saveNote(db, base.user.id, lessonId, "x".repeat(MAX_NOTE_LENGTH + 1), NOW)
    ).toThrow();
    expect(getNote(db, base.user.id, lessonId)).toBeUndefined();
  });
});

describe("listing a Student's saved lessons", () => {
  it("resolves each Bookmark and Note to Lesson · Module · Course", () => {
    toggleBookmark(db, base.user.id, lessonId);
    saveNote(db, base.user.id, otherLessonId, "a note", NOW);

    expect(getBookmarksForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({
        lessonId,
        lessonTitle: "Lesson 1",
        moduleTitle: "Basics",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      }),
    ]);
    expect(getNotesForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({
        lessonId: otherLessonId,
        body: "a note",
        moduleTitle: "Basics",
      }),
    ]);
  });

  it("lists Notes most recently edited first", () => {
    saveNote(db, base.user.id, lessonId, "older", NOW);
    saveNote(db, base.user.id, otherLessonId, "newer", LATER);

    expect(
      getNotesForStudent(db, base.user.id).map((note) => note.body)
    ).toEqual(["newer", "older"]);
  });
});

describe("deleting a lesson", () => {
  it("takes its Bookmarks and Notes with it", () => {
    toggleBookmark(db, base.user.id, lessonId);
    saveNote(db, base.user.id, lessonId, "a note", NOW);

    db.delete(schema.lessons).where(eq(schema.lessons.id, lessonId)).run();

    expect(getBookmarksForStudent(db, base.user.id)).toEqual([]);
    expect(getNotesForStudent(db, base.user.id)).toEqual([]);
  });
});
