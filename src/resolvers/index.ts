import type { GraphQLContext } from "../types/context.js";

// Placeholder root resolvers object — will be extended with Folder and Bookmark resolvers in Steps 4 & 5
export const resolvers = {
  Query: {
    folders: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.prisma.folder.findMany({
        orderBy: { createdAt: "desc" },
      });
    },
  },
};
