import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const sessionModeEnum = pgEnum("session_mode", ["practice", "assessment"]);
export const channelTypeEnum = pgEnum("channel_type", ["email", "call", "deck_review", "follow_up", "internal_coaching", "meeting"]);
export const difficultyEnum = pgEnum("difficulty", ["intro", "intermediate", "advanced"]);
export const artifactTypeEnum = pgEnum("artifact_type", ["one_pager", "email_recap", "risk_register", "meeting_agenda", "deck", "newsletter_brief", "custom"]);
export const artifactStatusEnum = pgEnum("artifact_status", ["draft", "submitted", "under_review", "revision_requested", "approved"]);
export const sessionStatusEnum = pgEnum("session_status", ["briefing", "active", "paused", "awaiting_review", "completed"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["pending", "in_progress", "completed"]);

// ─── Personas ────────────────────────────────────────────────────────────────

export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  personaType: text("persona_type").notNull(), // e.g., "difficult_skeptical", "analytical_calm", "cooperative"
  avatarInitials: text("avatar_initials").notNull(),
  avatarColor: text("avatar_color").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  behavioralInstructions: text("behavioral_instructions").notNull(),
  traits: jsonb("traits").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const personasRelations = relations(personas, ({ many }) => ({
  scenarioPersonas: many(scenarioPersonas),
}));

// ─── Scenarios ───────────────────────────────────────────────────────────────

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  briefing: text("briefing").notNull(),
  category: text("category").notNull(), // e.g., "sales", "leadership", "support"
  difficulty: difficultyEnum("difficulty").notNull().default("intermediate"),
  roleRequired: text("role_required").notNull(), // e.g., "Account Executive", "Sales Manager"
  seniorityLevel: text("seniority_level").notNull(), // e.g., "IC", "Manager", "Director"
  channels: jsonb("channels").$type<string[]>().notNull().default([]),
  constraints: jsonb("constraints").$type<{
    procurementStrictness: boolean;
    complianceSensitivity: boolean;
    tickingClockPressure: boolean;
    reputationalRisk: boolean;
    regulatoryExposure: boolean;
  }>().notNull(),
  requiredArtifacts: jsonb("required_artifacts").$type<string[]>().notNull().default([]),
  competencies: jsonb("competencies").$type<string[]>().notNull().default([]),
  learningObjectives: jsonb("learning_objectives").$type<string[]>().notNull().default([]),
  clientProfile: jsonb("client_profile").$type<{
    name: string;
    industry: string;
    size: string;
    background: string;
  }>().notNull(),
  featured: boolean("featured").notNull().default(false),
  estimatedSteps: integer("estimated_steps").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scenariosRelations = relations(scenarios, ({ many }) => ({
  scenarioPersonas: many(scenarioPersonas),
  sessions: many(sessions),
}));

// ─── Scenario-Persona join ──────────────────────────────────────────────────

export const scenarioPersonas = pgTable("scenario_personas", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").notNull().references(() => scenarios.id),
  personaId: integer("persona_id").notNull().references(() => personas.id),
  roleInScenario: text("role_in_scenario").notNull(),
  introduceAtStep: integer("introduce_at_step").notNull().default(1),
});

export const scenarioPersonasRelations = relations(scenarioPersonas, ({ one }) => ({
  scenario: one(scenarios, { fields: [scenarioPersonas.scenarioId], references: [scenarios.id] }),
  persona: one(personas, { fields: [scenarioPersonas.personaId], references: [personas.id] }),
}));

// ─── Templates ───────────────────────────────────────────────────────────────

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: artifactTypeEnum("type").notNull(),
  category: text("category").notNull(), // e.g., "sales", "general"
  roleMapping: text("role_mapping"), // e.g., "Enterprise AE discovery follow-up email"
  content: text("content").notNull(), // Template content/structure
  styleGuide: text("style_guide"), // "What good looks like"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sessions (Practice/Assessment runs) ─────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").notNull().references(() => scenarios.id),
  mode: sessionModeEnum("mode").notNull().default("practice"),
  status: sessionStatusEnum("status").notNull().default("briefing"),
  currentStep: integer("current_step").notNull().default(0),
  currentChannel: channelTypeEnum("current_channel").notNull().default("email"),
  userRole: text("user_role").notNull(),
  userSeniority: text("user_seniority").notNull(),
  config: jsonb("config").$type<{
    procurementStrictness: boolean;
    complianceSensitivity: boolean;
    tickingClockPressure: boolean;
  }>().notNull().default({
    procurementStrictness: false,
    complianceSensitivity: false,
    tickingClockPressure: false,
  }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  scenario: one(scenarios, { fields: [sessions.scenarioId], references: [scenarios.id] }),
  messages: many(messages),
  artifacts: many(artifacts),
  assessment: one(assessments),
}));

// ─── Messages (Multi-channel conversation) ───────────────────────────────────

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  channel: channelTypeEnum("channel").notNull(),
  senderType: text("sender_type").notNull(), // "user" | "persona" | "system"
  senderName: text("sender_name").notNull(),
  personaId: integer("persona_id").references(() => personas.id),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  step: integer("step").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
  persona: one(personas, { fields: [messages.personaId], references: [personas.id] }),
}));

// ─── Artifacts (Graded deliverables) ─────────────────────────────────────────

export const artifacts = pgTable("artifacts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  type: artifactTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  status: artifactStatusEnum("status").notNull().default("draft"),
  templateId: integer("template_id").references(() => templates.id),
  feedback: text("feedback"),
  score: integer("score"), // 0-100
  gradingDetails: jsonb("grading_details").$type<{
    clarity: number;
    completeness: number;
    accuracy: number;
    toneAppropriateness: number;
    templateConformance: number;
    commitmentAppropriateness: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  session: one(sessions, { fields: [artifacts.sessionId], references: [sessions.id] }),
  template: one(templates, { fields: [artifacts.templateId], references: [templates.id] }),
}));

// ─── Assessments ─────────────────────────────────────────────────────────────

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id).unique(),
  status: assessmentStatusEnum("status").notNull().default("pending"),
  overallScore: integer("overall_score"), // 0-100
  recommendation: text("recommendation"), // "pass" | "fail" | "needs_improvement"
  summary: text("summary"),
  scores: jsonb("scores").$type<{
    persuasiveness: number;
    objectionHandling: number;
    interpersonalVibe: number;
    writtenCommunication: number;
    artifactQuality: number;
    sequencingStrategy: number;
    decisionQuality: number;
  }>(),
  frictionPoints: jsonb("friction_points").$type<Array<{
    area: string;
    description: string;
    severity: "low" | "medium" | "high";
    channel: string;
  }>>(),
  strengths: jsonb("strengths").$type<string[]>(),
  areasForImprovement: jsonb("areas_for_improvement").$type<string[]>(),
  hitlRequired: boolean("hitl_required").notNull().default(true),
  hitlVerdict: text("hitl_verdict"),
  hitlNotes: text("hitl_notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  session: one(sessions, { fields: [assessments.sessionId], references: [sessions.id] }),
}));

// ─── User Configuration (stored in-memory for now, no auth) ──────────────────

export const userConfigs = pgTable("user_configs", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().default("Account Executive"),
  seniorityLevel: text("seniority_level").notNull().default("IC"),
  preferredMode: sessionModeEnum("preferred_mode").notNull().default("practice"),
  activeChannels: jsonb("active_channels").$type<string[]>().notNull().default(["email", "call", "deck_review", "follow_up"]),
  constraintToggles: jsonb("constraint_toggles").$type<{
    procurementStrictness: boolean;
    complianceSensitivity: boolean;
    tickingClockPressure: boolean;
  }>().notNull().default({
    procurementStrictness: false,
    complianceSensitivity: false,
    tickingClockPressure: false,
  }),
  activeTemplateIds: jsonb("active_template_ids").$type<number[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Insert schemas ──────────────────────────────────────────────────────────

export const insertPersonaSchema = createInsertSchema(personas).omit({ id: true, createdAt: true });
export const insertScenarioSchema = createInsertSchema(scenarios).omit({ id: true, createdAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, startedAt: true, completedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertArtifactSchema = createInsertSchema(artifacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssessmentSchema = createInsertSchema(assessments).omit({ id: true, createdAt: true, completedAt: true });
export const insertUserConfigSchema = createInsertSchema(userConfigs).omit({ id: true, updatedAt: true });

// ─── Types ───────────────────────────────────────────────────────────────────

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;

export type ScenarioPersona = typeof scenarioPersonas.$inferSelect;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

export type UserConfig = typeof userConfigs.$inferSelect;
export type InsertUserConfig = z.infer<typeof insertUserConfigSchema>;

// Keep existing greeting for backward compatibility
export const greetings = pgTable("greetings", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
});

export const insertGreetingSchema = createInsertSchema(greetings).pick({
  message: true,
});

export type Greeting = typeof greetings.$inferSelect;
export type InsertGreeting = z.infer<typeof insertGreetingSchema>;
