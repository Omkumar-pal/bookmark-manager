import { PrismaClient } from "@prisma/client";

// Global singleton instance of PrismaClient
export const prisma = new PrismaClient();
