import { greetings, type Greeting, type InsertGreeting } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getGreeting(): Promise<Greeting | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getGreeting(): Promise<Greeting | undefined> {
    return await db.query.greetings.findFirst();
  }
}

export const storage = new DatabaseStorage();
