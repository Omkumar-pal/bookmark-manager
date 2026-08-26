import { folderResolvers } from "./folder.js";
import { bookmarkResolvers } from "./bookmark.js";

export const resolvers = {
  Query: {
    ...folderResolvers.Query,
    ...bookmarkResolvers.Query,
  },
  Folder: {
    ...folderResolvers.Folder,
  },
  Bookmark: {
    ...bookmarkResolvers.Bookmark,
  },
  Mutation: {
    ...folderResolvers.Mutation,
    ...bookmarkResolvers.Mutation,
  },
};
