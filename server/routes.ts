import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { seedDatabase } from "./seed";
import { generatePersonaResponse, getActivePersonaForStep, generateChannelTransitionMessage } from "./persona-engine";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
    const scenario = await storage.getScenarioBySlug(req.params.slug);
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
    try {
      const template = await storage.createTemplate(req.body);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/templates/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const template = await storage.updateTemplate(id, req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/templates/:id", async (req, res) => {
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

    // Also get scenario details
    const scenario = await storage.getScenario(session.scenarioId);
    res.json({ ...session, scenario });
  });

  app.post(api.sessions.create.path, async (req, res) => {
    try {
      const session = await storage.createSession(req.body);
      const scenario = await storage.getScenario(session.scenarioId);

      if (scenario) {
        // Create initial briefing message
        await storage.createMessage({
          sessionId: session.id,
          channel: "email",
          senderType: "system",
          senderName: "System",
          content: scenario.briefing,
          step: 0,
        });
      }

      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const session = await storage.updateSession(id, req.body);
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  // ─── Messages ────────────────────────────────────────────────────────────
  app.get("/api/sessions/:sessionId/messages", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const messages = await storage.getMessages(sessionId);
    res.json(messages);
  });

  app.post("/api/sessions/:sessionId/messages", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const scenario = await storage.getScenario(session.scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });

    try {
      // Save user message
      const userMessage = await storage.createMessage({
        sessionId,
        channel: req.body.channel || session.currentChannel,
        senderType: "user",
        senderName: "You",
        content: req.body.content,
        step: session.currentStep,
      });

      // Update session status if it was in briefing
      if (session.status === "briefing") {
        await storage.updateSession(sessionId, { status: "active", currentStep: 1 });
      }

      const currentStep = session.status === "briefing" ? 1 : session.currentStep;

      // Get active persona for this step
      const activePersona = await getActivePersonaForStep(scenario.id, currentStep);

      let personaMessage = null;
      if (activePersona) {
        const allMessages = await storage.getMessages(sessionId);
        const responseContent = await generatePersonaResponse({
          session,
          scenario,
          persona: activePersona.persona,
          messages: allMessages,
          userMessage: req.body.content,
          channel: req.body.channel || session.currentChannel,
          step: currentStep,
        });

        personaMessage = await storage.createMessage({
          sessionId,
          channel: req.body.channel || session.currentChannel,
          senderType: "persona",
          senderName: activePersona.persona.name,
          personaId: activePersona.personaId,
          content: responseContent,
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

  // ─── Advance Step ────────────────────────────────────────────────────────
  app.post("/api/sessions/:sessionId/advance", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const scenario = await storage.getScenario(session.scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });

    const channels = scenario.channels as string[];
    const nextStep = session.currentStep + 1;

    if (nextStep > scenario.estimatedSteps) {
      // Move to assessment
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

    // Create transition message
    const transitionMsg = generateChannelTransitionMessage(nextChannel, nextStep, scenario);
    await storage.createMessage({
      sessionId,
      channel: nextChannel,
      senderType: "system",
      senderName: "System",
      content: transitionMsg,
      step: nextStep,
    });

    // Check if a new persona should be introduced
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
  app.get("/api/sessions/:sessionId/artifacts", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const artifacts = await storage.getArtifacts(sessionId);
    res.json(artifacts);
  });

  app.post("/api/sessions/:sessionId/artifacts", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    try {
      const artifact = await storage.createArtifact({
        ...req.body,
        sessionId,
      });
      res.status(201).json(artifact);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/artifacts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const artifact = await storage.updateArtifact(id, req.body);
    if (!artifact) return res.status(404).json({ message: "Artifact not found" });
    res.json(artifact);
  });

  // ─── Assessments ─────────────────────────────────────────────────────────
  app.get("/api/sessions/:sessionId/assessment", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
    const assessment = await storage.getAssessment(sessionId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    res.json(assessment);
  });

  app.post("/api/sessions/:sessionId/assessment", async (req, res) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

    const session = await storage.getSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Generate automated assessment based on session data
    const messages = await storage.getMessages(sessionId);
    const artifacts = await storage.getArtifacts(sessionId);

    const userMessages = messages.filter(m => m.senderType === "user");
    const hasArtifacts = artifacts.length > 0;
    const uniqueChannels = new Set(messages.map(m => m.channel));

    // Scoring based on engagement quality
    const messageDepth = Math.min(userMessages.length * 8, 100);
    const artifactBonus = hasArtifacts ? 15 : 0;
    const channelDiversity = Math.min(uniqueChannels.size * 12, 100);

    const scores = {
      persuasiveness: Math.min(Math.round(messageDepth * 0.8 + Math.random() * 20), 100),
      objectionHandling: Math.min(Math.round(messageDepth * 0.7 + Math.random() * 25), 100),
      interpersonalVibe: Math.min(Math.round(messageDepth * 0.75 + Math.random() * 20), 100),
      writtenCommunication: Math.min(Math.round((messageDepth + artifactBonus) * 0.8 + Math.random() * 15), 100),
      artifactQuality: hasArtifacts ? Math.min(Math.round(60 + Math.random() * 35), 100) : 0,
      sequencingStrategy: Math.min(Math.round(channelDiversity * 0.8 + Math.random() * 20), 100),
      decisionQuality: Math.min(Math.round(messageDepth * 0.65 + Math.random() * 30), 100),
    };

    const overallScore = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
    );

    const recommendation = overallScore >= 70 ? "pass" : overallScore >= 50 ? "needs_improvement" : "fail";

    const frictionPoints = [];
    if (!hasArtifacts) {
      frictionPoints.push({
        area: "Artifact Production",
        description: "No artifacts were submitted during the session. Required deliverables (one-pager, email recap, risk register) were not produced.",
        severity: "high" as const,
        channel: "all",
      });
    }
    if (userMessages.length < 3) {
      frictionPoints.push({
        area: "Engagement Depth",
        description: "Limited engagement with stakeholders. More substantive interactions would demonstrate stronger consultative selling skills.",
        severity: "medium" as const,
        channel: "all",
      });
    }
    if (uniqueChannels.size < 2) {
      frictionPoints.push({
        area: "Channel Diversity",
        description: "Engagement was limited to a single channel. Multi-channel sequencing is important for demonstrating full workflow competency.",
        severity: "medium" as const,
        channel: messages[0]?.channel || "email",
      });
    }

    const strengths = [];
    if (userMessages.length >= 5) strengths.push("Strong engagement depth across multiple touchpoints");
    if (hasArtifacts) strengths.push("Produced required deliverables demonstrating documentation discipline");
    if (uniqueChannels.size >= 3) strengths.push("Effective multi-channel sequencing and stakeholder management");

    const areasForImprovement = [];
    if (!hasArtifacts) areasForImprovement.push("Produce all required artifacts as first-class deliverables");
    if (userMessages.length < 5) areasForImprovement.push("Deepen engagement with more substantive stakeholder interactions");
    if (scores.objectionHandling < 60) areasForImprovement.push("Strengthen objection handling with more specific, evidence-based responses");

    try {
      const assessment = await storage.createAssessment({
        sessionId,
        status: "completed",
        overallScore,
        recommendation,
        summary: `Session completed with an overall score of ${overallScore}/100. ${recommendation === "pass" ? "The candidate demonstrated competent performance across the evaluated dimensions." : recommendation === "needs_improvement" ? "The candidate showed potential but needs improvement in key areas." : "The candidate did not meet the minimum performance threshold."} ${userMessages.length} user messages across ${uniqueChannels.size} channel(s). ${artifacts.length} artifact(s) submitted.`,
        scores,
        frictionPoints,
        strengths,
        areasForImprovement,
        hitlRequired: true,
      });

      // Update session status
      await storage.updateSession(sessionId, { status: "completed", completedAt: new Date() });

      res.status(201).json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/assessments/:id/hitl", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const assessment = await storage.updateAssessment(id, {
      hitlVerdict: req.body.verdict,
      hitlNotes: req.body.notes,
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
    try {
      const config = await storage.upsertUserConfig(req.body);
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
