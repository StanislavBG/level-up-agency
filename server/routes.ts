import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { seedDatabase } from "./seed";
import {
  getBilkoContext,
  executePersonaResponseStep,
  executeChannelTransitionStep,
  executeAssessmentStep,
  getActivePersonaForStep,
  createScenarioRun,
} from "./workflow-engine";
import {
  insertTemplateSchema,
  insertSessionSchema,
  createMessageBodySchema,
  createArtifactBodySchema,
  updateArtifactBodySchema,
  updateTemplateBodySchema,
  updateSessionBodySchema,
  hitlUpdateBodySchema,
  updateUserConfigBodySchema,
  slugParamSchema,
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

/** Format a ZodError into a concise 400-response payload. */
function formatValidationError(err: ZodError) {
  const formatted = fromZodError(err);
  return { message: formatted.message };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Initialize bilko-flow context on startup (registers step handlers)
  getBilkoContext();

  // ─── Greeting (backward compat) ──────────────────────────────────────────
  app.get(api.greeting.get.path, async (_req, res) => {
    res.json({ message: "Work Skills OS" });
  });

  // ─── Seed ────────────────────────────────────────────────────────────────
  app.post(api.seed.run.path, async (_req, res) => {
    try {
      const result = await seedDatabase();
      res.json(result);
    } catch (error: any) {
      console.error("Seed error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Scenarios ───────────────────────────────────────────────────────────
  app.get(api.scenarios.list.path, async (_req, res) => {
    const scenarios = await storage.getScenarios();
    res.json(scenarios);
  });

  app.get(api.scenarios.getBySlug.path, async (req, res) => {
    const slugResult = slugParamSchema.safeParse(req.params.slug);
    if (!slugResult.success) return res.status(400).json(formatValidationError(slugResult.error));
    const scenario = await storage.getScenarioBySlug(slugResult.data);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });
    res.json(scenario);
  });

  app.get(api.scenarios.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const scenario = await storage.getScenario(id);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });
    res.json(scenario);
  });

  // ─── Personas ────────────────────────────────────────────────────────────
  app.get(api.personas.list.path, async (_req, res) => {
    const personas = await storage.getPersonas();
    res.json(personas);
  });

  app.get(api.personas.getByScenario.path, async (req, res) => {
    const scenarioId = parseInt(req.params.scenarioId);
    if (isNaN(scenarioId)) return res.status(400).json({ message: "Invalid scenario ID" });
    const personas = await storage.getScenarioPersonas(scenarioId);
    res.json(personas);
  });

  app.get(api.personas.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const persona = await storage.getPersona(id);
    if (!persona) return res.status(404).json({ message: "Persona not found" });
    res.json(persona);
  });

  // ─── Templates ───────────────────────────────────────────────────────────
  app.get(api.templates.list.path, async (_req, res) => {
    const templates = await storage.getTemplates();
    res.json(templates);
  });

  app.post(api.templates.create.path, async (req, res) => {
    const parsed = insertTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    try {
      const template = await storage.createTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch(api.templates.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = updateTemplateBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    const template = await storage.updateTemplate(id, parsed.data);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete(api.templates.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const deleted = await storage.deleteTemplate(id);
    if (!deleted) return res.status(404).json({ message: "Template not found" });
    res.json({ message: "Template deleted" });
  });

  // ─── Sessions ────────────────────────────────────────────────────────────
  app.get(api.sessions.list.path, async (_req, res) => {
    const sessions = await storage.getSessions();
    res.json(sessions);
  });

  app.get(api.sessions.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const session = await storage.getSession(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const scenario = await storage.getScenario(session.scenarioId);
    res.json({ ...session, scenario });
  });

  app.post(api.sessions.create.path, async (req, res) => {
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    try {
      const session = await storage.createSession(parsed.data);
      const scenario = await storage.getScenario(session.scenarioId);

      if (scenario) {
        const firstChannel = (scenario.channels as string[])[0] || "email";

        // Create initial briefing system message
        await storage.createMessage({
          sessionId: session.id,
          channel: firstChannel as any,
          senderType: "system",
          senderName: "System",
          content: `**Welcome to your practice session: ${scenario.title}**\n\nYou are starting on the **${firstChannel === "email" ? "Email" : firstChannel === "call" ? "Call" : firstChannel.replace(/_/g, " ")}** channel. Read the briefing panel above, then type your opening message to begin.`,
          step: 0,
        });

        // Generate an initial persona greeting so the conversation isn't empty
        try {
          const firstPersona = await getActivePersonaForStep(scenario.id, 1);
          if (firstPersona) {
            const personaResult = await executePersonaResponseStep(
              session.id,
              scenario.id,
              firstPersona.personaId,
              firstPersona.persona.personaType,
              "initial outreach",
              firstChannel,
              0,
            );

            await storage.createMessage({
              sessionId: session.id,
              channel: firstChannel as any,
              senderType: "persona",
              senderName: personaResult.personaName,
              personaId: firstPersona.personaId,
              content: personaResult.response,
              step: 0,
            });
          }
        } catch (e) {
          // Persona greeting is non-blocking; session still works without it
          console.error("Initial persona greeting error (non-blocking):", e);
        }

        // Create a bilko-flow workflow run for this session
        try {
          await createScenarioRun(scenario.id, session.id);
        } catch (e) {
          // bilko-flow run creation is non-blocking; log but don't fail
          console.error("bilko-flow run creation error (non-blocking):", e);
        }
      }

      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch(api.sessions.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = updateSessionBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    const session = await storage.updateSession(id, parsed.data);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  // ─── Messages (bilko-flow: persona response via custom.persona-response step handler) ─
  app.get(api.messages.list.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const messages = await storage.getMessages(sessionId);
    res.json(messages);
  });

  app.post(api.messages.create.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

    const parsed = createMessageBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));

    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const scenario = await storage.getScenario(session.scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });

    try {
      // Save user message
      const userMessage = await storage.createMessage({
        sessionId,
        channel: parsed.data.channel || session.currentChannel,
        senderType: "user",
        senderName: "You",
        content: parsed.data.content,
        step: session.currentStep,
      });

      // Update session status if it was in briefing
      if (session.status === "briefing") {
        await storage.updateSession(sessionId, { status: "active", currentStep: 1 });
      }

      const currentStep = session.status === "briefing" ? 1 : session.currentStep;

      // Get active persona for this step (shared helper from workflow-engine)
      const activePersona = await getActivePersonaForStep(scenario.id, currentStep);

      let personaMessage = null;
      if (activePersona) {
        // Execute persona response via bilko-flow custom.persona-response step handler
        const personaResult = await executePersonaResponseStep(
          sessionId,
          scenario.id,
          activePersona.personaId,
          activePersona.persona.personaType,
          parsed.data.content,
          parsed.data.channel || session.currentChannel,
          currentStep,
        );

        personaMessage = await storage.createMessage({
          sessionId,
          channel: parsed.data.channel || session.currentChannel,
          senderType: "persona",
          senderName: personaResult.personaName,
          personaId: activePersona.personaId,
          content: personaResult.response,
          step: currentStep,
        });
      }

      res.status(201).json({
        userMessage,
        personaMessage,
        activePersona: activePersona ? {
          id: activePersona.personaId,
          name: activePersona.persona.name,
          role: activePersona.persona.role,
          roleInScenario: activePersona.roleInScenario,
          avatarInitials: activePersona.persona.avatarInitials,
          avatarColor: activePersona.persona.avatarColor,
        } : null,
      });
    } catch (error: any) {
      console.error("Message creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // ─── Advance Step (bilko-flow: channel transition via custom.channel-transition step handler) ─
  app.post(api.sessions.advance.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const scenario = await storage.getScenario(session.scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });

    const channels = scenario.channels as string[];
    const nextStep = session.currentStep + 1;

    if (nextStep > scenario.estimatedSteps) {
      await storage.updateSession(sessionId, {
        status: "awaiting_review",
        currentStep: nextStep,
      });
      return res.json({ status: "awaiting_review", step: nextStep });
    }

    const nextChannel = channels[(nextStep - 1) % channels.length] as any;

    await storage.updateSession(sessionId, {
      currentStep: nextStep,
      currentChannel: nextChannel,
    });

    // Execute channel transition via bilko-flow custom.channel-transition step handler
    const transitionMsg = await executeChannelTransitionStep(nextChannel, nextStep);

    await storage.createMessage({
      sessionId,
      channel: nextChannel,
      senderType: "system",
      senderName: "System",
      content: transitionMsg,
      step: nextStep,
    });

    const activePersona = await getActivePersonaForStep(scenario.id, nextStep);

    res.json({
      status: "active",
      step: nextStep,
      channel: nextChannel,
      activePersona: activePersona ? {
        id: activePersona.personaId,
        name: activePersona.persona.name,
        role: activePersona.persona.role,
        roleInScenario: activePersona.roleInScenario,
      } : null,
    });
  });

  // ─── Artifacts ───────────────────────────────────────────────────────────
  app.get(api.artifacts.list.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const artifacts = await storage.getArtifacts(sessionId);
    res.json(artifacts);
  });

  app.post(api.artifacts.create.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const parsed = createArtifactBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    try {
      const artifact = await storage.createArtifact({
        ...parsed.data,
        sessionId,
      });
      res.status(201).json(artifact);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch(api.artifacts.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = updateArtifactBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    const artifact = await storage.updateArtifact(id, parsed.data);
    if (!artifact) return res.status(404).json({ message: "Artifact not found" });
    res.json(artifact);
  });

  // ─── Assessments (bilko-flow: scoring via custom.assessment step handler) ─
  app.get(api.assessments.get.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const assessment = await storage.getAssessment(sessionId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    res.json(assessment);
  });

  app.post(api.assessments.create.path, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    try {
      // Execute assessment via bilko-flow custom.assessment step handler
      const assessmentResult = await executeAssessmentStep(sessionId);

      const assessment = await storage.createAssessment({
        sessionId,
        status: "completed",
        overallScore: assessmentResult.overallScore,
        recommendation: assessmentResult.recommendation,
        summary: assessmentResult.summary,
        scores: assessmentResult.scores as any,
        frictionPoints: assessmentResult.frictionPoints as any,
        strengths: assessmentResult.strengths,
        areasForImprovement: assessmentResult.areasForImprovement,
        hitlRequired: true,
      });

      await storage.updateSession(sessionId, { status: "completed", completedAt: new Date() });

      res.status(201).json(assessment);
    } catch (error: any) {
      console.error("Assessment generation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch(api.assessments.updateHitl.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = hitlUpdateBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    const assessment = await storage.updateAssessment(id, {
      hitlVerdict: parsed.data.verdict,
      hitlNotes: parsed.data.notes,
    });
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    res.json(assessment);
  });

  // ─── User Config ─────────────────────────────────────────────────────────
  app.get(api.userConfig.get.path, async (_req, res) => {
    let config = await storage.getUserConfig();
    if (!config) {
      config = await storage.upsertUserConfig({});
    }
    res.json(config);
  });

  app.patch(api.userConfig.update.path, async (req, res) => {
    const parsed = updateUserConfigBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(formatValidationError(parsed.error));
    try {
      const config = await storage.upsertUserConfig(parsed.data);
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
