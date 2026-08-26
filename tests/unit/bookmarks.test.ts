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

  it("Query.bookmarks should handle pagination flags correctly (hasNextPage)", async () => {
    const now = new Date();
    // Return 3 items when take=2 to trigger hasNextPage = true
    const mockList = [
      { id: "bm-1", title: "Site 1", url: "https://1.com", tags: [], folderId: "f-1", createdAt: now },
      { id: "bm-2", title: "Site 2", url: "https://2.com", tags: [], folderId: "f-1", createdAt: now },
      { id: "bm-3", title: "Site 3", url: "https://3.com", tags: [], folderId: "f-1", createdAt: now },
    ];

    const context: GraphQLContext = {
      prisma: {
        bookmark: {
          findMany: mock(async () => mockList),
          count: mock(async () => 5),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    const result = await bookmarkResolvers.Query.bookmarks({}, { take: 2 }, context);
    expect(result.edges).toHaveLength(2);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.endCursor).toBeDefined();
    expect(result.totalCount).toBe(5);
  });
});
