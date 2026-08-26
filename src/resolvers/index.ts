import { folderResolvers } from "./folder.js";

export const resolvers = {
  Query: {
    ...folderResolvers.Query,
  },
  Folder: {
    ...folderResolvers.Folder,
  },
  Mutation: {
    ...folderResolvers.Mutation,
  },
};
