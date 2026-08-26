import { describe, expect, it, mock } from "bun:test";
import { folderResolvers } from "../../src/resolvers/folder.js";
import type { GraphQLContext } from "../../src/types/context.js";
import { ErrorCode } from "../../src/lib/errors.js";

describe("Folder Resolvers Unit Tests", () => {
  it("Query.folders should return folders sorted by createdAt desc", async () => {
    const mockFolders = [
      { id: "folder-1", name: "Tech", createdAt: new Date("2026-01-02") },
      { id: "folder-2", name: "News", createdAt: new Date("2026-01-01") },
    ];

    const context: GraphQLContext = {
      prisma: {
        folder: {
          findMany: mock(async () => mockFolders),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    const result = await folderResolvers.Query.folders({}, {}, context);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Tech");
  });

  it("Query.folder should return single folder by ID", async () => {
    const mockFolder = { id: "folder-1", name: "Tech", createdAt: new Date() };

    const context: GraphQLContext = {
      prisma: {
        folder: {
          findUnique: mock(async () => mockFolder),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    const result = await folderResolvers.Query.folder({}, { id: "folder-1" }, context);
    expect(result).toBeDefined();
    expect(result?.id).toBe("folder-1");
  });

  it("Mutation.createFolder should validate name and create folder", async () => {
    const mockCreated = { id: "folder-new", name: "Design", createdAt: new Date() };

    const context: GraphQLContext = {
      prisma: {
        folder: {
          create: mock(async () => mockCreated),
        },
      } as unknown as GraphQLContext["prisma"],
    };

    const result = await folderResolvers.Mutation.createFolder({}, { name: "  Design  " }, context);
    expect(result.name).toBe("Design");
  });

  it("Mutation.createFolder should reject blank name", async () => {
    const context: GraphQLContext = {
      prisma: {} as unknown as GraphQLContext["prisma"],
    };

    try {
      await folderResolvers.Mutation.createFolder({}, { name: "   " }, context);
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      const err = error as { extensions?: { code?: string } };
      expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
    }
  });
});
