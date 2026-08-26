import type { Folder } from "@prisma/client";
import type { GraphQLContext } from "../types/context.js";
import { validateTitle } from "../lib/validation.js";

interface FolderArgs {
  id: string;
}

interface CreateFolderArgs {
  name: string;
}

export const folderResolvers = {
  Query: {
    folders: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.prisma.folder.findMany({
        orderBy: { createdAt: "desc" },
      });
    },

    folder: async (_parent: unknown, args: FolderArgs, context: GraphQLContext) => {
      return context.prisma.folder.findUnique({
        where: { id: args.id },
      });
    },
  },

  Folder: {
    // Nested resolver: returns bookmarks for a given folder
    bookmarks: async (parent: Folder, _args: unknown, context: GraphQLContext) => {
      return context.prisma.bookmark.findMany({
        where: { folderId: parent.id },
        orderBy: { createdAt: "desc" },
      });
    },
    // Format Date to ISO string
    createdAt: (parent: Folder): string => {
      return parent.createdAt instanceof Date ? parent.createdAt.toISOString() : String(parent.createdAt);
    },
  },

  Mutation: {
    createFolder: async (_parent: unknown, args: CreateFolderArgs, context: GraphQLContext) => {
      const validName = validateTitle(args.name, "Folder name");

      return context.prisma.folder.create({
        data: {
          name: validName,
        },
      });
    },
  },
};
