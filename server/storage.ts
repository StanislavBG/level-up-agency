import {
  personas, scenarios, scenarioPersonas, templates, sessions, messages, artifacts, assessments, userConfigs, greetings,
  type Persona, type InsertPersona,
  type Scenario, type InsertScenario,
  type ScenarioPersona,
  type Template, type InsertTemplate,
  type Session, type InsertSession,
  type Message, type InsertMessage,
  type Artifact, type InsertArtifact,
  type Assessment, type InsertAssessment,
  type UserConfig, type InsertUserConfig,
  type Greeting,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc } from "drizzle-orm";

export interface IStorage {
  getGreeting(): Promise<Greeting | undefined>;

  // Personas
  getPersonas(): Promise<Persona[]>;
  getPersona(id: number): Promise<Persona | undefined>;
  createPersona(data: InsertPersona): Promise<Persona>;

  // Scenarios
  getScenarios(): Promise<Scenario[]>;
  getScenario(id: number): Promise<Scenario | undefined>;
  getScenarioBySlug(slug: string): Promise<Scenario | undefined>;
  createScenario(data: InsertScenario): Promise<Scenario>;
  getScenarioPersonas(scenarioId: number): Promise<(ScenarioPersona & { persona: Persona })[]>;
  linkPersonaToScenario(scenarioId: number, personaId: number, roleInScenario: string, introduceAtStep?: number): Promise<ScenarioPersona>;

  // Templates
  getTemplates(): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  createTemplate(data: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: number): Promise<boolean>;

  // Sessions
  getSessions(): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  createSession(data: InsertSession): Promise<Session>;
  updateSession(id: number, data: Partial<Session>): Promise<Session | undefined>;

  // Messages
  getMessages(sessionId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;

  // Artifacts
  getArtifacts(sessionId: number): Promise<Artifact[]>;
  createArtifact(data: InsertArtifact): Promise<Artifact>;
  updateArtifact(id: number, data: Partial<Artifact>): Promise<Artifact | undefined>;

  // Assessments
  getAssessment(sessionId: number): Promise<Assessment | undefined>;
  createAssessment(data: InsertAssessment): Promise<Assessment>;
  updateAssessment(id: number, data: Partial<Assessment>): Promise<Assessment | undefined>;

  // User Config
  getUserConfig(): Promise<UserConfig | undefined>;
  upsertUserConfig(data: Partial<InsertUserConfig>): Promise<UserConfig>;
}

export class DatabaseStorage implements IStorage {
  async getGreeting(): Promise<Greeting | undefined> {
    return await db.query.greetings.findFirst();
  }

  // ─── Personas ────────────────────────────────────────────────────────────────

  async getPersonas(): Promise<Persona[]> {
    return await db.select().from(personas).orderBy(asc(personas.name));
  }

  async getPersona(id: number): Promise<Persona | undefined> {
    return await db.query.personas.findFirst({ where: eq(personas.id, id) });
  }

  async createPersona(data: InsertPersona): Promise<Persona> {
    const [result] = await db.insert(personas).values(data as any).returning();
    return result;
  }

  // ─── Scenarios ───────────────────────────────────────────────────────────────

  async getScenarios(): Promise<Scenario[]> {
    return await db.select().from(scenarios).orderBy(desc(scenarios.featured), asc(scenarios.title));
  }

  async getScenario(id: number): Promise<Scenario | undefined> {
    return await db.query.scenarios.findFirst({ where: eq(scenarios.id, id) });
  }

  async getScenarioBySlug(slug: string): Promise<Scenario | undefined> {
    return await db.query.scenarios.findFirst({ where: eq(scenarios.slug, slug) });
  }

  async createScenario(data: InsertScenario): Promise<Scenario> {
    const [result] = await db.insert(scenarios).values(data as any).returning();
    return result;
  }

  async getScenarioPersonas(scenarioId: number): Promise<(ScenarioPersona & { persona: Persona })[]> {
    const results = await db
      .select()
      .from(scenarioPersonas)
      .innerJoin(personas, eq(scenarioPersonas.personaId, personas.id))
      .where(eq(scenarioPersonas.scenarioId, scenarioId))
      .orderBy(asc(scenarioPersonas.introduceAtStep));

    return results.map(r => ({
      ...r.scenario_personas,
      persona: r.personas,
    }));
  }

  async linkPersonaToScenario(scenarioId: number, personaId: number, roleInScenario: string, introduceAtStep = 1): Promise<ScenarioPersona> {
    const [result] = await db.insert(scenarioPersonas).values({
      scenarioId,
      personaId,
      roleInScenario,
      introduceAtStep,
    }).returning();
    return result;
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  async getTemplates(): Promise<Template[]> {
    return await db.select().from(templates).orderBy(asc(templates.name));
  }

  async getTemplate(id: number): Promise<Template | undefined> {
    return await db.query.templates.findFirst({ where: eq(templates.id, id) });
  }

  async createTemplate(data: InsertTemplate): Promise<Template> {
    const [result] = await db.insert(templates).values(data as any).returning();
    return result;
  }

  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [result] = await db.update(templates).set(data).where(eq(templates.id, id)).returning();
    return result;
  }

  async deleteTemplate(id: number): Promise<boolean> {
    const result = await db.delete(templates).where(eq(templates.id, id)).returning();
    return result.length > 0;
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  async getSessions(): Promise<Session[]> {
    return await db.select().from(sessions).orderBy(desc(sessions.startedAt));
  }

  async getSession(id: number): Promise<Session | undefined> {
    return await db.query.sessions.findFirst({ where: eq(sessions.id, id) });
  }

  async createSession(data: InsertSession): Promise<Session> {
    const [result] = await db.insert(sessions).values(data as any).returning();
    return result;
  }

  async updateSession(id: number, data: Partial<Session>): Promise<Session | undefined> {
    const [result] = await db.update(sessions).set(data as any).where(eq(sessions.id, id)).returning();
    return result;
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async getMessages(sessionId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [result] = await db.insert(messages).values(data as any).returning();
    return result;
  }

  // ─── Artifacts ───────────────────────────────────────────────────────────────

  async getArtifacts(sessionId: number): Promise<Artifact[]> {
    return await db.select().from(artifacts)
      .where(eq(artifacts.sessionId, sessionId))
      .orderBy(desc(artifacts.updatedAt));
  }

  async createArtifact(data: InsertArtifact): Promise<Artifact> {
    const [result] = await db.insert(artifacts).values(data as any).returning();
    return result;
  }

  async updateArtifact(id: number, data: Partial<Artifact>): Promise<Artifact | undefined> {
    const [result] = await db.update(artifacts).set({ ...data, updatedAt: new Date() } as any).where(eq(artifacts.id, id)).returning();
    return result;
  }

  // ─── Assessments ─────────────────────────────────────────────────────────────

  async getAssessment(sessionId: number): Promise<Assessment | undefined> {
    return await db.query.assessments.findFirst({ where: eq(assessments.sessionId, sessionId) });
  }

  async createAssessment(data: InsertAssessment): Promise<Assessment> {
    const [result] = await db.insert(assessments).values(data as any).returning();
    return result;
  }

  async updateAssessment(id: number, data: Partial<Assessment>): Promise<Assessment | undefined> {
    const [result] = await db.update(assessments).set(data as any).where(eq(assessments.id, id)).returning();
    return result;
  }

  // ─── User Config ─────────────────────────────────────────────────────────────

  async getUserConfig(): Promise<UserConfig | undefined> {
    return await db.query.userConfigs.findFirst();
  }

  async upsertUserConfig(data: Partial<InsertUserConfig>): Promise<UserConfig> {
    const existing = await this.getUserConfig();
    if (existing) {
      const [result] = await db.update(userConfigs)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(userConfigs.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(userConfigs).values({
      role: data.role ?? "Account Executive",
      seniorityLevel: data.seniorityLevel ?? "IC",
      preferredMode: data.preferredMode ?? "practice",
      activeChannels: data.activeChannels ?? ["email", "call", "deck_review", "follow_up"],
      constraintToggles: data.constraintToggles ?? {
        procurementStrictness: false,
        complianceSensitivity: false,
        tickingClockPressure: false,
      },
      activeTemplateIds: data.activeTemplateIds ?? [],
    } as any).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
