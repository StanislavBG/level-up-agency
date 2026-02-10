import { storage } from "./storage";
import type { Message, Persona, Session, Scenario } from "@shared/schema";

/**
 * Persona conversation engine.
 *
 * This module generates contextual persona responses based on the persona's
 * system prompt, behavioral instructions, and the conversation history.
 *
 * In production, this would integrate with an LLM API (OpenAI, Anthropic, etc.).
 * Currently uses a rule-based response system that follows persona behavioral
 * patterns to provide realistic interactions.
 */

interface ConversationContext {
  session: Session;
  scenario: Scenario;
  persona: Persona;
  messages: Message[];
  userMessage: string;
  channel: string;
  step: number;
}

// Response templates keyed by persona type and conversation stage
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

function getResponseStage(messages: Message[], personaId: number): string {
  const personaMessages = messages.filter(m => m.personaId === personaId);
  const count = personaMessages.length;

  if (count === 0) return "opening";
  if (count <= 2) return "objection";
  if (count <= 4) return "engaged";
  return "closing";
}

function getAnalyticalStage(messages: Message[], personaId: number): string {
  const personaMessages = messages.filter(m => m.personaId === personaId);
  const count = personaMessages.length;

  if (count === 0) return "opening";
  if (count <= 2) return "probing";
  if (count <= 4) return "satisfied";
  return "closing";
}

function getCooperativeStage(messages: Message[], personaId: number): string {
  const personaMessages = messages.filter(m => m.personaId === personaId);
  const count = personaMessages.length;

  if (count === 0) return "opening";
  if (count <= 2) return "coaching";
  if (count <= 4) return "supportive";
  return "closing";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getContextualModifier(context: ConversationContext): string {
  const { userMessage, channel } = context;
  const lower = userMessage.toLowerCase();

  // Add channel-specific framing
  let channelPrefix = "";
  if (channel === "email") {
    channelPrefix = "";
  } else if (channel === "call") {
    channelPrefix = "";
  } else if (channel === "deck_review") {
    channelPrefix = "\n\nRegarding the materials you've shared—";
  }

  // Add topic-specific reactions
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

export async function generatePersonaResponse(context: ConversationContext): Promise<string> {
  const { persona, messages, userMessage } = context;
  const patterns = responsePatterns[persona.personaType];

  if (!patterns) {
    return `Thank you for your message. I'll review this and get back to you with my thoughts. [${persona.name}]`;
  }

  let stage: string;
  if (persona.personaType === "analytical_calm") {
    stage = getAnalyticalStage(messages, persona.id);
  } else if (persona.personaType === "cooperative") {
    stage = getCooperativeStage(messages, persona.id);
  } else {
    stage = getResponseStage(messages, persona.id);
  }

  const stageResponses = patterns[stage];
  if (!stageResponses || stageResponses.length === 0) {
    return `I've noted your points. Let me think about this and we can discuss further. [${persona.name}]`;
  }

  const baseResponse = pickRandom(stageResponses);
  const modifier = getContextualModifier(context);

  return baseResponse + modifier;
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

  // Find personas that should be active at this step
  const activePersonas = scenarioPersonas.filter(sp => sp.introduceAtStep <= step);

  if (activePersonas.length === 0) return null;

  // Rotate through active personas based on step
  const index = (step - 1) % activePersonas.length;
  const selected = activePersonas[index];

  return {
    personaId: selected.personaId,
    persona: selected.persona,
    roleInScenario: selected.roleInScenario,
  };
}

/**
 * Generates a system/briefing message for the start of a new channel interaction.
 */
export function generateChannelTransitionMessage(channel: string, step: number, scenario: Scenario): string {
  const transitions: Record<string, string> = {
    email: `**Step ${step}: Email Outreach**\n\nYou're composing an email to initiate or continue the engagement. Consider your audience, tone, and what you want to accomplish with this touchpoint.`,
    call: `**Step ${step}: Discovery Call**\n\nYou're on a call with the stakeholder. This is a live conversation—be prepared for real-time questions and objections. Listen actively and adapt your approach.`,
    deck_review: `**Step ${step}: Deck / Presentation Review**\n\nYou're presenting or reviewing materials with the stakeholder. They'll scrutinize your claims, data, and recommendations. Be prepared to defend every slide.`,
    follow_up: `**Step ${step}: Follow-Up**\n\nThis is a follow-up touchpoint. Reference previous conversations and demonstrate that you've been listening. Confirm decisions, clarify next steps, and address any outstanding concerns.`,
    internal_coaching: `**Step ${step}: Internal Strategy Session**\n\nYou're meeting with your internal ally for coaching and strategy. This is a safe space to align on approach, get advice on stakeholder dynamics, and prepare for upcoming interactions.`,
    meeting: `**Step ${step}: Stakeholder Meeting**\n\nYou're in a formal meeting with multiple stakeholders. Navigate competing priorities and build consensus while maintaining credibility with each participant.`,
  };

  return transitions[channel] || `**Step ${step}**: Continue the engagement through ${channel}.`;
}
