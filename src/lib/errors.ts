import { GraphQLError } from "graphql";

export enum ErrorCode {
  BAD_USER_INPUT = "BAD_USER_INPUT",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

export function badUserInputError(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCode.BAD_USER_INPUT,
      http: { status: 400 },
    },
  });
}

export function notFoundError(entity: string, id: string): GraphQLError {
  return new GraphQLError(`${entity} with ID "${id}" was not found`, {
    extensions: {
      code: ErrorCode.NOT_FOUND,
      http: { status: 404 },
    },
  });
}
