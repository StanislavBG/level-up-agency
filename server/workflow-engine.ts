/**
 * Bilko-Flow Integration Layer
 *
 * Replaces the custom agentic sequences (session workflow progression,
 * persona conversation engine, assessment generation) with bilko-flow
 * deterministic workflow execution.
 *
 * Three custom step handlers are registered:
 * 1. custom.persona-response  — Generates persona responses based on type + stage
 * 2. custom.assessment        — Scores sessions across 7 dimensions
 * 3. custom.channel-transition — Manages channel switches between steps
 */

import {
  createAppContext,
  registerStepHandler,
  type AppContext,
  type StepHandler,
  type Workflow,
  type Step,
  type Run,
  type CreateRunInput,
  WorkflowStatus,
  DeterminismGrade,
} from "bilko-flow";
import type { CompiledStep, StepExecutionContext } from "bilko-flow";
import { storage } from "./storage";
import type { Persona, Scenario, Message } from "@shared/schema";

// ─── Bilko-Flow Application Context (singleton) ─────────────────────────────

let bilkoContext: AppContext | null = null;

const BILKO_ACCOUNT_ID = "skills-os";
const BILKO_PROJECT_ID = "work-skills";
const BILKO_ENV_ID = "production";

export function getBilkoContext(): AppContext {
  if (!bilkoContext) {
    bilkoContext = createAppContext();
    registerCustomStepHandlers();
  }
  return bilkoContext;
}

export function getBilkoScope() {
  return {
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
  };
}

// ─── Response patterns for persona step handler ──────────────────────────────

const responsePatterns: Record<string, Record<string, string[]>> = {
  difficult_skeptical: {
    opening: [
      "I appreciate you reaching out, but I need to be upfront—we get a lot of these pitches. My first question is simple: why should we prioritize this over the dozen other vendor proposals on my desk right now?",
      "Thanks for the intro. Before we go any further, I need to understand the budget implications. Walk me through the pricing, and be specific about what's included vs. what costs extra.",
      "Let me cut to the chase—I've been burned by vendors before who promised the world and delivered a PowerPoint. What makes your offering different, and what hard evidence do you have?",
    ],
    objection: [
      "I hear what you're saying, but that's a claim, not evidence. Can you point me to a specific customer in our industry who saw those results? I'd want to talk to them directly.",
      "That timeline doesn't work with our procurement process. We have a mandatory 90-day vendor onboarding. Have you factored that into your proposal?",
      "You're asking me to commit budget before we've even done a proper technical evaluation. That's not how this works. What does a pilot look like?",
      "I need to push back here—our existing tools cover some of this. You need to show me the delta, not the whole value prop. What specifically do we NOT get from Bloomberg and Thomson Reuters?",
    ],
    engaged: [
      "Okay, that's more useful. Now, assuming we move forward with a pilot, what's the minimum viable scope? I don't want a boil-the-ocean approach.",
      "Fair point. But I still need to see this in terms my CFO understands. Can you translate that into cost-per-insight or time-saved metrics?",
      "That addresses my procurement concern. What about the security review? Our IT team will need SOC 2 documentation at minimum.",
    ],
    closing: [
      "I'm not saying no, but I'm not saying yes yet either. Here's what I need to see before our next conversation: a clear scope document, pricing breakdown, and at least two reference customers I can call. Can you deliver that by end of week?",
      "You've addressed most of my concerns. I'll take this to our steering committee, but I need a one-pager I can leave behind—something that answers the 'why now' and 'what's the risk of inaction' in language my peers understand.",
    ],
  },
  analytical_calm: {
    opening: [
      "Thank you for the overview. I'd like to dive deeper into the methodology. Can you walk me through your data collection pipeline—specifically, what sources do you aggregate and what's your signal-to-noise filtering approach?",
      "I've reviewed the materials you sent. I have some technical questions about data provenance and validation. First, how do you ensure the accuracy and timeliness of your regulatory signal detection?",
      "Interesting proposition. Before I can evaluate the fit, I need to understand the technical architecture. Is this a real-time streaming system or batch processing? What's the typical latency from event to alert?",
    ],
    probing: [
      "That's helpful context. Now, regarding integration—we run a complex stack including ServiceNow, Veeva, and a custom data lake. What does your API layer look like? Do you support webhooks, REST, or both?",
      "I appreciate the transparency. Follow-up question: how do you handle cross-jurisdictional regulatory differences? An FDA action doesn't always map cleanly to EMA or PMDA equivalents.",
      "The data quality sounds reasonable. But what about edge cases? How does your system handle ambiguous regulatory language or conflicting signals from different agencies?",
      "One more thing—data sovereignty. Where is our data processed and stored? We have strict requirements about data residency for anything touching patient-adjacent systems.",
    ],
    satisfied: [
      "That's a thorough answer. I'm more confident about the technical foundation now. My remaining concern is the integration timeline—realistically, how long does a typical implementation take for a company of our complexity?",
      "Good. The compliance story checks out. I'd want to see your SOC 2 report and any HIPAA compliance documentation before we proceed, but the architecture approach is sound.",
    ],
    closing: [
      "From a technical perspective, I'm satisfied with what I've seen. I'd recommend we proceed with a limited pilot scoped to one business unit. I'll flag the integration requirements to our IT team. Can you provide a technical requirements document?",
    ],
  },
  cooperative: {
    opening: [
      "Hey! I'm really glad we're having this conversation. I've been pushing for something like this internally for months. Quick context: our CEO mentioned supply chain visibility at the last town hall, so the timing is actually perfect. But—and I want to be honest with you—getting budget approved here is a process. Let me tell you what you're up against.",
      "Thanks for following up. I've been thinking about how to position this internally. I think the approach is right, but I need your help framing it in a way that resonates with our leadership. They're practical people—they want to see ROI in plain language.",
    ],
    coaching: [
      "Here's a tip: when you talk to Margaret, lead with the risk-of-inaction angle, not the feature list. She responds to 'what happens if we DON'T do this' better than 'here's what you get.'",
      "I should mention—the steering committee meets Thursday. If you can get me that one-pager by Wednesday evening, I can put it on the agenda. Otherwise we're waiting another two weeks.",
      "One thing to be careful about: don't overpromise on the timeline. Margaret will hold you to every date you give her. Better to under-promise and over-deliver.",
      "I think we should propose a phased approach. Start with one region as a pilot, show results, then expand. That's easier to get through procurement than a company-wide rollout.",
    ],
    supportive: [
      "That's exactly the kind of framing that will work. Let me tell you what I can do on my end—I'll schedule a pre-meeting with James to get his technical questions addressed before the formal presentation. That way, the steering committee meeting is about decision-making, not discovery.",
      "Good call on the risk register. That shows you understand our internal processes. I'll add my own context to it before we circulate it internally.",
      "I love this draft, but I have some edits. The second paragraph is a bit too salesy for internal circulation. Can we make it more neutral? I need this to look like my recommendation, not your pitch.",
    ],
    closing: [
      "I think we're in good shape. Here's what happens next on my end: I'll circulate the one-pager to the steering committee, set up the pilot scoping call with James, and give Margaret a heads-up that this is coming through procurement. On your end, I need the reference customers and the technical requirements doc. Deal?",
    ],
  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getStageForPersonaType(personaType: string, messageCount: number): string {
  if (personaType === "analytical_calm") {
    if (messageCount === 0) return "opening";
    if (messageCount <= 2) return "probing";
    if (messageCount <= 4) return "satisfied";
    return "closing";
  }
  if (personaType === "cooperative") {
    if (messageCount === 0) return "opening";
    if (messageCount <= 2) return "coaching";
    if (messageCount <= 4) return "supportive";
    return "closing";
  }
  // difficult_skeptical and default
  if (messageCount === 0) return "opening";
  if (messageCount <= 2) return "objection";
  if (messageCount <= 4) return "engaged";
  return "closing";
}

function getContextualModifier(userMessage: string, channel: string): string {
  const lower = userMessage.toLowerCase();
  let channelPrefix = "";
  if (channel === "deck_review") {
    channelPrefix = "\n\nRegarding the materials you've shared—";
  }
  if (lower.includes("price") || lower.includes("cost") || lower.includes("budget")) {
    return channelPrefix + "\n\nOn the pricing question specifically—that's clearly a critical factor in our decision. ";
  }
  if (lower.includes("compliance") || lower.includes("regulatory") || lower.includes("hipaa")) {
    return channelPrefix + "\n\nThe compliance angle is important and I'm glad you raised it. ";
  }
  if (lower.includes("timeline") || lower.includes("deadline") || lower.includes("urgent")) {
    return channelPrefix + "\n\nTimeline is definitely top of mind for us right now. ";
  }
  if (lower.includes("pilot") || lower.includes("trial") || lower.includes("proof of concept")) {
    return channelPrefix + "\n\nA pilot approach is interesting—let me think about how that would work operationally. ";
  }
  return channelPrefix;
}

// ─── Custom Step Handlers ────────────────────────────────────────────────────

function registerCustomStepHandlers() {
  /**
   * Step handler: custom.persona-response
   *
   * Generates a persona response based on persona type, conversation stage,
   * and user message context. This replaces the standalone persona-engine module.
   *
   * Inputs:
   *   - personaId: number
   *   - personaType: string
   *   - userMessage: string
   *   - channel: string
   *   - sessionId: number
   *   - priorPersonaMessageCount: number
   *
   * Outputs:
   *   - response: string
   *   - stage: string
   *   - personaName: string
   */
  const personaResponseHandler: StepHandler = {
    type: "custom.persona-response",
    async execute(step: CompiledStep, context: StepExecutionContext) {
      const { personaId, personaType, userMessage, channel, priorPersonaMessageCount } =
        step.inputs as {
          personaId: number;
          personaType: string;
          userMessage: string;
          channel: string;
          sessionId: number;
          priorPersonaMessageCount: number;
        };

      const persona = await storage.getPersona(personaId);
      const personaName = persona?.name ?? "Unknown";

      const patterns = responsePatterns[personaType];
      if (!patterns) {
        return {
          outputs: {
            response: `Thank you for your message. I'll review this and get back to you with my thoughts.`,
            stage: "fallback",
            personaName,
          },
        };
      }

      const stage = getStageForPersonaType(personaType, priorPersonaMessageCount);
      const stageResponses = patterns[stage];
      if (!stageResponses || stageResponses.length === 0) {
        return {
          outputs: {
            response: `I've noted your points. Let me think about this and we can discuss further.`,
            stage,
            personaName,
          },
        };
      }

      const baseResponse = pickRandom(stageResponses);
      const modifier = getContextualModifier(userMessage, channel);

      return {
        outputs: {
          response: baseResponse + modifier,
          stage,
          personaName,
        },
      };
    },
  };

  /**
   * Step handler: custom.channel-transition
   *
   * Generates a system message for transitioning between channels in the
   * multi-channel workflow. Replaces generateChannelTransitionMessage.
   *
   * Inputs:
   *   - channel: string
   *   - stepNumber: number
   *
   * Outputs:
   *   - transitionMessage: string
   *   - channel: string
   */
  const channelTransitionHandler: StepHandler = {
    type: "custom.channel-transition",
    async execute(step: CompiledStep, _context: StepExecutionContext) {
      const { channel, stepNumber } = step.inputs as {
        channel: string;
        stepNumber: number;
      };

      const transitions: Record<string, string> = {
        email: `**Step ${stepNumber}: Email Outreach**\n\nYou're composing an email to initiate or continue the engagement. Consider your audience, tone, and what you want to accomplish with this touchpoint.`,
        call: `**Step ${stepNumber}: Discovery Call**\n\nYou're on a call with the stakeholder. This is a live conversation—be prepared for real-time questions and objections. Listen actively and adapt your approach.`,
        deck_review: `**Step ${stepNumber}: Deck / Presentation Review**\n\nYou're presenting or reviewing materials with the stakeholder. They'll scrutinize your claims, data, and recommendations. Be prepared to defend every slide.`,
        follow_up: `**Step ${stepNumber}: Follow-Up**\n\nThis is a follow-up touchpoint. Reference previous conversations and demonstrate that you've been listening. Confirm decisions, clarify next steps, and address any outstanding concerns.`,
        internal_coaching: `**Step ${stepNumber}: Internal Strategy Session**\n\nYou're meeting with your internal ally for coaching and strategy. This is a safe space to align on approach, get advice on stakeholder dynamics, and prepare for upcoming interactions.`,
        meeting: `**Step ${stepNumber}: Stakeholder Meeting**\n\nYou're in a formal meeting with multiple stakeholders. Navigate competing priorities and build consensus while maintaining credibility with each participant.`,
      };

      return {
        outputs: {
          transitionMessage: transitions[channel] || `**Step ${stepNumber}**: Continue the engagement through ${channel}.`,
          channel,
        },
      };
    },
  };

  /**
   * Step handler: custom.assessment
   *
   * Generates an automated assessment of the session across 7 dimensions.
   * Replaces the inline assessment generation in routes.ts.
   *
   * Inputs:
   *   - sessionId: number
   *   - userMessageCount: number
   *   - artifactCount: number
   *   - uniqueChannelCount: number
   *   - hasArtifacts: boolean
   *
   * Outputs:
   *   - scores: { ... }
   *   - overallScore: number
   *   - recommendation: string
   *   - summary: string
   *   - frictionPoints: [...]
   *   - strengths: [...]
   *   - areasForImprovement: [...]
   */
  const assessmentHandler: StepHandler = {
    type: "custom.assessment",
    async execute(step: CompiledStep, _context: StepExecutionContext) {
      const {
        sessionId,
        userMessageCount,
        artifactCount,
        uniqueChannelCount,
        hasArtifacts,
      } = step.inputs as {
        sessionId: number;
        userMessageCount: number;
        artifactCount: number;
        uniqueChannelCount: number;
        hasArtifacts: boolean;
      };

      const messageDepth = Math.min(userMessageCount * 8, 100);
      const artifactBonus = hasArtifacts ? 15 : 0;
      const channelDiversity = Math.min(uniqueChannelCount * 12, 100);

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

      const frictionPoints: Array<{ area: string; description: string; severity: string; channel: string }> = [];
      if (!hasArtifacts) {
        frictionPoints.push({
          area: "Artifact Production",
          description: "No artifacts were submitted during the session. Required deliverables were not produced.",
          severity: "high",
          channel: "all",
        });
      }
      if (userMessageCount < 3) {
        frictionPoints.push({
          area: "Engagement Depth",
          description: "Limited engagement with stakeholders. More substantive interactions would demonstrate stronger consultative selling skills.",
          severity: "medium",
          channel: "all",
        });
      }
      if (uniqueChannelCount < 2) {
        frictionPoints.push({
          area: "Channel Diversity",
          description: "Engagement was limited to a single channel. Multi-channel sequencing is important for demonstrating full workflow competency.",
          severity: "medium",
          channel: "email",
        });
      }

      const strengths: string[] = [];
      if (userMessageCount >= 5) strengths.push("Strong engagement depth across multiple touchpoints");
      if (hasArtifacts) strengths.push("Produced required deliverables demonstrating documentation discipline");
      if (uniqueChannelCount >= 3) strengths.push("Effective multi-channel sequencing and stakeholder management");

      const areasForImprovement: string[] = [];
      if (!hasArtifacts) areasForImprovement.push("Produce all required artifacts as first-class deliverables");
      if (userMessageCount < 5) areasForImprovement.push("Deepen engagement with more substantive stakeholder interactions");
      if (scores.objectionHandling < 60) areasForImprovement.push("Strengthen objection handling with more specific, evidence-based responses");

      const summary = `Session completed with an overall score of ${overallScore}/100. ${
        recommendation === "pass"
          ? "The candidate demonstrated competent performance across the evaluated dimensions."
          : recommendation === "needs_improvement"
          ? "The candidate showed potential but needs improvement in key areas."
          : "The candidate did not meet the minimum performance threshold."
      } ${userMessageCount} user messages across ${uniqueChannelCount} channel(s). ${artifactCount} artifact(s) submitted.`;

      return {
        outputs: {
          scores,
          overallScore,
          recommendation,
          summary,
          frictionPoints,
          strengths,
          areasForImprovement,
        },
      };
    },
  };

  registerStepHandler(personaResponseHandler);
  registerStepHandler(channelTransitionHandler);
  registerStepHandler(assessmentHandler);
}

// ─── Workflow Builder ────────────────────────────────────────────────────────

/**
 * Builds a bilko-flow Workflow definition from a scenario.
 * Each scenario channel becomes a step in the workflow, followed by an
 * assessment step at the end.
 */
export function buildScenarioWorkflow(scenario: Scenario): Workflow {
  const channels = scenario.channels as string[];
  const workflowId = `wf-scenario-${scenario.id}`;
  const steps: Step[] = [];
  const previousStepIds: string[] = [];

  // Create channel-transition + persona-response step pairs for each channel
  for (let i = 0; i < scenario.estimatedSteps; i++) {
    const channel = channels[i % channels.length];
    const stepNum = i + 1;

    // Channel transition step
    const transitionStepId = `step-${stepNum}-transition`;
    steps.push({
      id: transitionStepId,
      workflowId,
      name: `Channel Transition: ${channel} (Step ${stepNum})`,
      type: "custom" as any,
      description: `Transition to ${channel} channel at step ${stepNum}`,
      dependsOn: previousStepIds.length > 0 ? [previousStepIds[previousStepIds.length - 1]] : [],
      inputs: {
        channel,
        stepNumber: stepNum,
        _handlerType: "custom.channel-transition",
      },
      policy: {
        timeoutMs: 5000,
        maxAttempts: 1,
      },
    });

    // Persona response step (depends on transition)
    const responseStepId = `step-${stepNum}-persona`;
    steps.push({
      id: responseStepId,
      workflowId,
      name: `Persona Response: Step ${stepNum}`,
      type: "custom" as any,
      description: `Generate persona response for step ${stepNum} on ${channel}`,
      dependsOn: [transitionStepId],
      inputs: {
        personaId: 0, // Will be resolved at runtime
        personaType: "", // Will be resolved at runtime
        userMessage: "", // Will be provided at runtime
        channel,
        sessionId: 0, // Will be provided at runtime
        priorPersonaMessageCount: 0, // Will be computed at runtime
        _handlerType: "custom.persona-response",
      },
      policy: {
        timeoutMs: 10000,
        maxAttempts: 1,
      },
    });

    previousStepIds.push(responseStepId);
  }

  // Assessment step at the end
  const assessmentStepId = "step-assessment";
  steps.push({
    id: assessmentStepId,
    workflowId,
    name: "Generate Assessment",
    type: "custom" as any,
    description: "Score the session across 7 dimensions and generate assessment report",
    dependsOn: previousStepIds.length > 0 ? [previousStepIds[previousStepIds.length - 1]] : [],
    inputs: {
      sessionId: 0,
      userMessageCount: 0,
      artifactCount: 0,
      uniqueChannelCount: 0,
      hasArtifacts: false,
      _handlerType: "custom.assessment",
    },
    policy: {
      timeoutMs: 15000,
      maxAttempts: 1,
    },
  });

  const now = new Date().toISOString();

  return {
    id: workflowId,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
    name: `Scenario: ${scenario.title}`,
    description: scenario.description,
    version: 1,
    specVersion: "1.0.0",
    status: WorkflowStatus.Active,
    createdAt: now,
    updatedAt: now,
    determinism: {
      targetGrade: DeterminismGrade.BestEffort,
    },
    entryStepId: steps[0].id,
    steps,
    secrets: [],
  };
}

// ─── Run Management ──────────────────────────────────────────────────────────

/**
 * Creates and stores a bilko-flow workflow for a scenario, then creates a run.
 * Returns the run ID for tracking.
 */
export async function createScenarioRun(scenarioId: number, sessionId: number): Promise<string> {
  const ctx = getBilkoContext();
  const scenario = await storage.getScenario(scenarioId);
  if (!scenario) throw new Error("Scenario not found");

  const workflow = buildScenarioWorkflow(scenario);

  // Store the workflow in bilko-flow's store
  await ctx.store.workflows.create(workflow);

  // Create a run
  const run = await ctx.executor.createRun({
    workflowId: workflow.id,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
    inputs: {
      scenarioId,
      sessionId,
    },
  });

  return run.id;
}

/**
 * Executes a persona response step using the bilko-flow step handler.
 * Called when a user sends a message during a session.
 */
export async function executePersonaResponseStep(
  sessionId: number,
  scenarioId: number,
  personaId: number,
  personaType: string,
  userMessage: string,
  channel: string,
  step: number,
): Promise<{ response: string; stage: string; personaName: string }> {
  const ctx = getBilkoContext();

  // Count prior persona messages for this persona in this session
  const allMessages = await storage.getMessages(sessionId);
  const priorPersonaMessageCount = allMessages.filter(m => m.personaId === personaId).length;

  // Build a one-off workflow with a single persona-response step
  const now = new Date().toISOString();
  const workflowId = `wf-persona-${sessionId}-${step}-${Date.now()}`;
  const oneOffWorkflow: Workflow = {
    id: workflowId,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
    name: `Persona Response (Session ${sessionId}, Step ${step})`,
    version: 1,
    specVersion: "1.0.0",
    status: WorkflowStatus.Active,
    createdAt: now,
    updatedAt: now,
    determinism: { targetGrade: DeterminismGrade.BestEffort },
    entryStepId: "persona-step",
    steps: [
      {
        id: "persona-step",
        workflowId,
        name: "Generate Persona Response",
        type: "custom" as any,
        dependsOn: [],
        inputs: {
          personaId,
          personaType,
          userMessage,
          channel,
          sessionId,
          priorPersonaMessageCount,
        },
        policy: { timeoutMs: 10000, maxAttempts: 1 },
      },
    ],
    secrets: [],
  };

  await ctx.store.workflows.create(oneOffWorkflow);

  const run = await ctx.executor.createRun({
    workflowId: oneOffWorkflow.id,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
  });

  const executedRun = await ctx.executor.executeRun(run.id, getBilkoScope());

  const stepResult = executedRun.stepResults["persona-step"];
  if (stepResult?.outputs) {
    return {
      response: stepResult.outputs.response as string,
      stage: stepResult.outputs.stage as string,
      personaName: stepResult.outputs.personaName as string,
    };
  }

  return {
    response: "Thank you for your message. I'll review this and get back to you.",
    stage: "fallback",
    personaName: "Unknown",
  };
}

/**
 * Executes a channel transition step using bilko-flow.
 * Called when advancing to the next step in a session.
 */
export async function executeChannelTransitionStep(
  channel: string,
  stepNumber: number,
): Promise<string> {
  const ctx = getBilkoContext();
  const now = new Date().toISOString();
  const wfId = `wf-transition-${stepNumber}-${Date.now()}`;

  const workflow: Workflow = {
    id: wfId,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
    name: `Channel Transition (Step ${stepNumber})`,
    version: 1,
    specVersion: "1.0.0",
    status: WorkflowStatus.Active,
    createdAt: now,
    updatedAt: now,
    determinism: { targetGrade: DeterminismGrade.Pure },
    entryStepId: "transition-step",
    steps: [
      {
        id: "transition-step",
        workflowId: wfId,
        name: "Channel Transition",
        type: "custom" as any,
        dependsOn: [],
        inputs: { channel, stepNumber },
        policy: { timeoutMs: 5000, maxAttempts: 1 },
      },
    ],
    secrets: [],
  };

  await ctx.store.workflows.create(workflow);

  const run = await ctx.executor.createRun({
    workflowId: workflow.id,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
  });

  const executedRun = await ctx.executor.executeRun(run.id, getBilkoScope());
  const stepResult = executedRun.stepResults["transition-step"];

  return (stepResult?.outputs?.transitionMessage as string) ||
    `**Step ${stepNumber}**: Continue the engagement through ${channel}.`;
}

/**
 * Executes the assessment generation step using bilko-flow.
 * Called when a session is completed and needs scoring.
 */
export async function executeAssessmentStep(
  sessionId: number,
): Promise<{
  scores: Record<string, number>;
  overallScore: number;
  recommendation: string;
  summary: string;
  frictionPoints: Array<{ area: string; description: string; severity: string; channel: string }>;
  strengths: string[];
  areasForImprovement: string[];
}> {
  const ctx = getBilkoContext();

  const messages = await storage.getMessages(sessionId);
  const artifacts = await storage.getArtifacts(sessionId);

  const userMessages = messages.filter(m => m.senderType === "user");
  const uniqueChannels = new Set(messages.map(m => m.channel));

  const now = new Date().toISOString();
  const wfId = `wf-assessment-${sessionId}-${Date.now()}`;

  const workflow: Workflow = {
    id: wfId,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
    name: `Assessment (Session ${sessionId})`,
    version: 1,
    specVersion: "1.0.0",
    status: WorkflowStatus.Active,
    createdAt: now,
    updatedAt: now,
    determinism: { targetGrade: DeterminismGrade.BestEffort },
    entryStepId: "assessment-step",
    steps: [
      {
        id: "assessment-step",
        workflowId: wfId,
        name: "Generate Assessment",
        type: "custom" as any,
        dependsOn: [],
        inputs: {
          sessionId,
          userMessageCount: userMessages.length,
          artifactCount: artifacts.length,
          uniqueChannelCount: uniqueChannels.size,
          hasArtifacts: artifacts.length > 0,
        },
        policy: { timeoutMs: 15000, maxAttempts: 1 },
      },
    ],
    secrets: [],
  };

  await ctx.store.workflows.create(workflow);

  const run = await ctx.executor.createRun({
    workflowId: workflow.id,
    accountId: BILKO_ACCOUNT_ID,
    projectId: BILKO_PROJECT_ID,
    environmentId: BILKO_ENV_ID,
  });

  const executedRun = await ctx.executor.executeRun(run.id, getBilkoScope());
  const stepResult = executedRun.stepResults["assessment-step"];

  if (stepResult?.outputs) {
    return {
      scores: stepResult.outputs.scores as Record<string, number>,
      overallScore: stepResult.outputs.overallScore as number,
      recommendation: stepResult.outputs.recommendation as string,
      summary: stepResult.outputs.summary as string,
      frictionPoints: stepResult.outputs.frictionPoints as any[],
      strengths: stepResult.outputs.strengths as string[],
      areasForImprovement: stepResult.outputs.areasForImprovement as string[],
    };
  }

  throw new Error("Assessment step failed to produce outputs");
}

/**
 * Determines which persona should respond next based on the session's
 * current step and the scenario's persona introduction schedule.
 */
export async function getActivePersonaForStep(
  scenarioId: number,
  step: number
): Promise<{ personaId: number; persona: Persona; roleInScenario: string } | null> {
  const scenarioPersonas = await storage.getScenarioPersonas(scenarioId);
  const activePersonas = scenarioPersonas.filter(sp => sp.introduceAtStep <= step);

  if (activePersonas.length === 0) return null;

  const index = (step - 1) % activePersonas.length;
  const selected = activePersonas[index];

  return {
    personaId: selected.personaId,
    persona: selected.persona,
    roleInScenario: selected.roleInScenario,
  };
}
