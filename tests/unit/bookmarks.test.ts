import { describe, expect, it, mock } from "bun:test";
import { bookmarkResolvers } from "../../src/resolvers/bookmark.js";
import type { GraphQLContext } from "../../src/types/context.js";
import { ErrorCode } from "../../src/lib/errors.js";

describe("Bookmark Resolvers Unit Tests", () => {
  it("Mutation.createBookmark should throw NOT_FOUND when folder does not exist", async () => {
    const context: GraphQLContext = {
      prisma: {
        folder: {
          findUnique: mock(async () => null),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    try {
      await bookmarkResolvers.Mutation.createBookmark(
        {},
        { title: "Prisma", url: "https://prisma.io", folderId: "non-existent-folder" },
        context
      );
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string }; message?: string };
      expect(err.extensions?.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toContain("Folder");
    }
  });

  it("Mutation.deleteBookmark should throw NOT_FOUND if bookmark does not exist", async () => {
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findUnique: mock(async () => null),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    try {
      await bookmarkResolvers.Mutation.deleteBookmark({}, { id: "non-existent-bm" }, context);
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string }; message?: string };
      expect(err.extensions?.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toContain("Bookmark");
    }
  });

  it("Mutation.moveBookmark should throw NOT_FOUND if target folder does not exist", async () => {
    const mockBookmark = {
      id: "bm-1",
      title: "Google",
      url: "https://google.com",
      tags: [],
      folderId: "folder-1",
      createdAt: new Date(),
    };

    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findUnique: mock(async () => mockBookmark),
        },
        folder: {
          findUnique: mock(async () => null), // Destination folder not found
        },
      } as unknown as GraphQLContext["prisma"],
    };

    try {
      await bookmarkResolvers.Mutation.moveBookmark(
        {},
        { id: "bm-1", folderId: "invalid-target-folder" },
        context
      );
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string }; message?: string };
      expect(err.extensions?.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toContain("Folder");
    }
  });

  it("Query.bookmarks should throw BAD_USER_INPUT for invalid cursor (fails base64 regex)", async () => {
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async () => []),
          count: mock(async () => 0),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    try {
      await bookmarkResolvers.Query.bookmarks({}, { cursor: "not-base64!" }, context);
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string }; message?: string };
      expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
      expect(err.message).toContain("Invalid cursor format");
    }
  });

  it("Query.bookmarks should throw BAD_USER_INPUT for malformed cursor (missing separator)", async () => {
    // Valid base64 but missing "::" separator
    const invalidCursor = Buffer.from("2026-01-01T00:00:00.000Z").toString("base64");
    
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async () => []),
          count: mock(async () => 0),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    try {
      await bookmarkResolvers.Query.bookmarks({}, { cursor: invalidCursor }, context);
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string }; message?: string };
      expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
    }
  });

  it("Query.bookmarks should throw BAD_USER_INPUT for cursor with invalid date", async () => {
    const invalidCursor = Buffer.from("not-a-date::some-id").toString("base64");
    
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async () => []),
          count: mock(async () => 0),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    try {
      await bookmarkResolvers.Query.bookmarks({}, { cursor: invalidCursor }, context);
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string }; message?: string };
      expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
    }
  });

  it("Query.bookmarks should work with valid cursor", async () => {
    const now = new Date();
    const validCursor = Buffer.from(`${now.toISOString()}::valid-id`).toString("base64");
    
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async () => []),
          count: mock(async () => 0),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    const result = await bookmarkResolvers.Query.bookmarks({}, { cursor: validCursor }, context);
    expect(result).toBeDefined();
    expect(result.edges).toHaveLength(0);
  });

  it("Query.bookmarks should clamp take to max 50", async () => {
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async (args: unknown) => {
            const typedArgs = args as { take?: number };
            // Assert Prisma was actually called with take: 51 (50 + 1 for pagination check)
            expect(typedArgs.take).toBe(51);
            return [];
          }),
          count: mock(async () => 0),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    await bookmarkResolvers.Query.bookmarks({}, { take: 9999 }, context);
  });

  it("Query.bookmarks should clamp take to min 1", async () => {
    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async (args: unknown) => {
            const typedArgs = args as { take?: number };
            expect(typedArgs.take).toBe(2); // 1 + 1
            return [];
          }),
          count: mock(async () => 0),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    await bookmarkResolvers.Query.bookmarks({}, { take: -5 }, context);
  });

  it("Query.bookmarks should correctly detect next page and set totalCount", async () => {
    const mockBookmarks = [
      { id: "3", title: "C", url: "https://c.com", tags: [], folderId: "f1", createdAt: new Date("2026-01-03") },
      { id: "2", title: "B", url: "https://b.com", tags: [], folderId: "f1", createdAt: new Date("2026-01-02") },
      { id: "1", title: "A", url: "https://a.com", tags: [], folderId: "f1", createdAt: new Date("2026-01-01") },
    ];

    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async () => mockBookmarks), // 3 returned for take:2 → simulates "one extra" fetched
          count: mock(async () => 5),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    const result = await bookmarkResolvers.Query.bookmarks({}, { take: 2 }, context);

    expect(result.edges).toHaveLength(2); // trimmed down from 3 to 2
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.endCursor).toBeDefined();
    expect(result.totalCount).toBe(5);
  });
});
