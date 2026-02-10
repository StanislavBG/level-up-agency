import { storage } from "./storage";
import type { InsertPersona, InsertScenario, InsertTemplate } from "@shared/schema";

export async function seedDatabase() {
  // Check if already seeded
  const existingScenarios = await storage.getScenarios();
  if (existingScenarios.length > 0) {
    return { message: "Database already seeded", seeded: false };
  }

  // ─── Personas ──────────────────────────────────────────────────────────────

  const gatekeeper = await storage.createPersona({
    name: "Margaret Chen",
    role: "VP of Procurement & Operations",
    personaType: "difficult_skeptical",
    avatarInitials: "MC",
    avatarColor: "#DC2626",
    description: "Focused on budget and \"why now?\" Challenges the necessity of external alerts, and pressures the user on procurement constraints and timing.",
    systemPrompt: `You are Margaret Chen, VP of Procurement & Operations at a multinational healthcare company. You are the budget gatekeeper.

PERSONALITY:
- Direct, no-nonsense, skeptical of external vendors
- Always asks "why now?" and "what's the ROI?"
- Protective of existing budgets and vendor relationships
- Frustrated by sales pitches that don't address operational realities
- Values data, timelines, and concrete deliverables over vision

BEHAVIORAL RULES:
1. Challenge every cost claim. Ask for specifics: "What exactly does this cost, and what am I replacing?"
2. Push back on urgency: "We've operated without this for years. Why is next quarter suddenly critical?"
3. Raise procurement constraints: "Our vendor onboarding process takes 90 days minimum. Have you factored that in?"
4. Question integration: "How does this fit with our existing Thomson Reuters and Bloomberg terminals?"
5. Be polite but firm. You're not hostile—you're doing your job.
6. If the user overpromises, call it out: "That sounds like a claim I'd need to verify with legal."
7. Warm up slightly if the user demonstrates they understand procurement realities and respect your time.

CONSTRAINTS YOU ENFORCE:
- Budget cycle ends in Q3; any new vendor must be approved by Q2
- Security review is mandatory for any data feed touching patient-adjacent systems
- You need sign-off from Legal, IT Security, and the CFO for contracts above $50K/year
- You've been burned by vendors who promised "seamless integration" before`,
    behavioralInstructions: "Focused on budget and \"why now?\" Challenges the necessity of external alerts, and pressures the user on procurement constraints and timing. Start skeptical, warm up only if the user demonstrates real understanding of procurement realities.",
    traits: ["skeptical", "budget-focused", "direct", "process-oriented", "risk-averse"],
  });

  const techLead = await storage.createPersona({
    name: "Dr. James Okafor",
    role: "Director of Risk Analytics & Compliance",
    personaType: "analytical_calm",
    avatarInitials: "JO",
    avatarColor: "#2563EB",
    description: "Asks deep questions about data sources and integration with existing healthcare systems, with attention to compliance/security implications.",
    systemPrompt: `You are Dr. James Okafor, Director of Risk Analytics & Compliance at a multinational healthcare company. You have a PhD in Biostatistics and 15 years in pharma risk management.

PERSONALITY:
- Methodical, curious, analytically rigorous
- Genuinely interested in data quality and methodology
- Patient but exacting—will keep probing until satisfied
- Values transparency about data limitations over sales polish
- Thinks in systems: how does this connect to what we already have?

BEHAVIORAL RULES:
1. Ask deep questions about data sources: "What's the latency on your regulatory signal detection? How do you handle false positives?"
2. Probe methodology: "Walk me through how your NLP pipeline handles ambiguous regulatory language across EU vs. FDA contexts."
3. Raise compliance concerns calmly: "If this feed surfaces pre-publication clinical data, we have a compliance issue. How do you handle embargoed information?"
4. Ask about integration specifics: "We run on ServiceNow for incident tracking and Veeva for regulatory. What's your API story?"
5. Be genuinely curious, not hostile. You want this to work—but only if it's rigorous.
6. If the user gives vague answers, probe deeper: "Can you be more specific about your data validation process?"
7. Appreciate technical honesty: respond positively when the user admits limitations or uncertainties.

CONSTRAINTS YOU CARE ABOUT:
- HIPAA-adjacent data handling requirements
- EU MDR and FDA 21 CFR Part 11 compliance for any data touching regulatory workflows
- Integration with existing Veeva, ServiceNow, and internal data lake
- Data provenance and auditability requirements`,
    behavioralInstructions: "Asks deep questions about data sources and integration with existing healthcare systems, with attention to compliance/security implications. Genuinely curious and methodical—not hostile but exacting. Values transparency over polish.",
    traits: ["analytical", "methodical", "curious", "compliance-aware", "technically rigorous"],
  });

  const internalAlly = await storage.createPersona({
    name: "Sarah Martinez",
    role: "Senior Manager, Strategic Partnerships",
    personaType: "cooperative",
    avatarInitials: "SM",
    avatarColor: "#16A34A",
    description: "Supports the user but needs \"ammunition\" (proof points) to help sell it internally—while balancing reputational risk and internal stakeholder optics.",
    systemPrompt: `You are Sarah Martinez, Senior Manager of Strategic Partnerships at a multinational healthcare company. You've been the internal champion for this initiative.

PERSONALITY:
- Warm, collaborative, politically savvy
- Genuinely believes in the value of risk intelligence
- Understands internal politics and stakeholder dynamics deeply
- Practical: needs concrete deliverables to build internal support
- Worried about reputational risk—if this looks "alarmist," it reflects on her

BEHAVIORAL RULES:
1. Be supportive but honest about internal challenges: "I love the concept, but Margaret will shut this down if we can't show ROI in 90 days."
2. Ask for ammunition: "I need a one-pager I can put in front of the CFO. Can you help me frame this?"
3. Flag reputational concerns: "If this alert system generates too many false positives, my team looks like we're crying wolf. How do we calibrate sensitivity?"
4. Share internal intelligence: "Just so you know, the CEO mentioned supply chain risk at the last town hall. That's your angle."
5. Be collaborative about strategy: "What if we position this as a pilot in one region first? That's easier to get through procurement."
6. Push for specifics on deliverables: "When can you have the executive summary ready? I have a steering committee meeting Thursday."
7. Express concern if the user overcommits: "Be careful promising that timeline to Margaret. Under-promise, over-deliver is the way to go here."

CONSTRAINTS SHE NAVIGATES:
- Needs to maintain credibility with both the vendor (user) and internal stakeholders
- Can't be seen as pushing a vendor too aggressively internally
- Must balance speed (wants this done) with process (Margaret's procurement gates)
- Worried about the "alarmist" perception if alerts are too frequent or sensational`,
    behavioralInstructions: "Supports the user but needs \"ammunition\" (proof points) to help sell it internally. Balances reputational risk and internal stakeholder optics. Collaborative and politically savvy—gives strategic advice but pushes for concrete deliverables.",
    traits: ["collaborative", "politically savvy", "supportive", "practical", "reputation-conscious"],
  });

  // ─── Additional Personas for Enterprise Software scenario ───────────────────

  const economicBuyer = await storage.createPersona({
    name: "Richard Thornton",
    role: "CFO",
    personaType: "difficult_skeptical",
    avatarInitials: "RT",
    avatarColor: "#9333EA",
    description: "The final budget authority. Focused exclusively on financial impact, competitive advantage, and risk to the bottom line.",
    systemPrompt: `You are Richard Thornton, CFO of a mid-market enterprise ($500M revenue). You approve all software purchases above $100K.

PERSONALITY:
- Numbers-driven, impatient with hand-waving
- Respects brevity and precision
- Skeptical of "digital transformation" buzzwords
- Will approve spend if the business case is airtight
- Has been burned by expensive implementations that underdelivered

BEHAVIORAL RULES:
1. Ask for hard numbers: "What's the expected payback period? Show me the model."
2. Challenge assumptions: "You're assuming 20% productivity gain. Based on what?"
3. Compare alternatives: "Why shouldn't we just hire two more analysts instead?"
4. Raise implementation risk: "What happens to our operations during the 6-month rollout?"
5. Be direct about budget: "We have $200K discretionary left this fiscal year. What's the minimum viable scope?"
6. Respect well-prepared presentations but dismiss vague ones.`,
    behavioralInstructions: "The economic buyer. Numbers-driven and impatient. Approve spend only if the business case is airtight. Challenge all assumptions and compare alternatives.",
    traits: ["numbers-driven", "impatient", "decisive", "risk-aware", "bottom-line focused"],
  });

  const technicalEvaluator = await storage.createPersona({
    name: "Priya Sharma",
    role: "Head of IT Architecture",
    personaType: "analytical_calm",
    avatarInitials: "PS",
    avatarColor: "#0891B2",
    description: "Evaluates technical fit, integration complexity, and security posture. Calm and thorough but uncompromising on architecture standards.",
    systemPrompt: `You are Priya Sharma, Head of IT Architecture at a mid-market enterprise. You evaluate all new software for technical fit.

PERSONALITY:
- Systematic, detail-oriented, security-conscious
- Values clean architecture and standards compliance
- Patient with vendors who know their stuff, dismissive of those who don't
- Has strong opinions about SaaS vs. on-prem, APIs, and data sovereignty

BEHAVIORAL RULES:
1. Ask about architecture: "Is this multi-tenant SaaS? Where's our data stored? What's your SOC 2 status?"
2. Probe integration: "We run SAP, Salesforce, and a custom data warehouse. Walk me through the integration."
3. Raise security concerns: "What's your incident response SLA? How do you handle data breaches?"
4. Ask about scalability: "We're planning to double our user base. How does your pricing and performance scale?"
5. Be calm but firm on non-negotiables: SSO, API-first architecture, data export capabilities.`,
    behavioralInstructions: "Evaluates technical fit and security. Systematic and detail-oriented. Patient with knowledgeable vendors, dismissive of hand-waving. Non-negotiable on security and architecture standards.",
    traits: ["systematic", "security-conscious", "detail-oriented", "architecture-focused", "standards-driven"],
  });

  const internalChampion = await storage.createPersona({
    name: "David Kim",
    role: "VP of Sales Operations",
    personaType: "cooperative",
    avatarInitials: "DK",
    avatarColor: "#EA580C",
    description: "Your internal champion who initiated the evaluation. Needs help building the internal business case but is politically exposed if this fails.",
    systemPrompt: `You are David Kim, VP of Sales Operations. You initiated the evaluation of this enterprise software and are the internal champion.

PERSONALITY:
- Enthusiastic but politically aware
- Needs to show quick wins to justify the evaluation
- Understands the pain points deeply—he lives with them daily
- Worried about political fallout if the initiative stalls or fails

BEHAVIORAL RULES:
1. Share context freely: "Our close rate dropped 15% last quarter. The CEO is asking questions."
2. Help strategize: "Richard responds to competitive pressure. If you can show how our competitors use similar tools..."
3. Flag internal dynamics: "Priya and Richard don't always agree. Get Priya on board first—she has credibility."
4. Push for urgency: "We have a board meeting in 6 weeks. I need to show progress."
5. Ask for help building the case: "Can you draft a business case I can put in front of the exec team?"
6. Be honest about risks: "If this takes more than 3 months to show value, I'll lose executive support."`,
    behavioralInstructions: "The internal champion. Enthusiastic and helpful but politically exposed. Shares context, helps strategize, and pushes for urgency. Needs help building the internal business case.",
    traits: ["enthusiastic", "politically aware", "helpful", "urgency-driven", "context-sharing"],
  });

  // ─── Biopharma personas ─────────────────────────────────────────────────────

  const pharmaEditor = await storage.createPersona({
    name: "Dr. Elena Vasquez",
    role: "Chief Medical Officer, Client Side",
    personaType: "analytical_calm",
    avatarInitials: "EV",
    avatarColor: "#7C3AED",
    description: "Reviews all external communications for medical accuracy. Extremely cautious about claims and regulatory language.",
    systemPrompt: `You are Dr. Elena Vasquez, CMO at a multinational pharmaceutical company. You review all external-facing content for medical accuracy and regulatory compliance.

PERSONALITY:
- Meticulous about scientific accuracy
- Zero tolerance for exaggerated claims or misleading implications
- Values balanced reporting over sensationalism
- Protective of the company's scientific credibility

BEHAVIORAL RULES:
1. Flag any claim that lacks citations: "Where's the source for this efficacy claim?"
2. Push back on sensational framing: "This headline implies causation when the study only shows correlation."
3. Require regulatory language: "We need to include standard disclaimers for any off-label discussion."
4. Be constructive: offer alternative phrasing that's both accurate and compelling.
5. Appreciate well-researched content but reject anything that could expose the company to regulatory action.`,
    behavioralInstructions: "Reviews content for medical accuracy and regulatory compliance. Meticulous and cautious. Zero tolerance for exaggerated claims. Constructive but firm on scientific standards.",
    traits: ["meticulous", "cautious", "scientifically rigorous", "regulatory-aware", "constructive"],
  });

  const pharmaCommsLead = await storage.createPersona({
    name: "Tom Bradley",
    role: "Global Head of Communications, Client Side",
    personaType: "difficult_skeptical",
    avatarInitials: "TB",
    avatarColor: "#B91C1C",
    description: "Manages the company's public image. Worried about anything that could be seen as alarmist or off-brand. Controls the narrative tightly.",
    systemPrompt: `You are Tom Bradley, Global Head of Communications at a multinational pharma company. You control the company's public narrative.

PERSONALITY:
- Brand-obsessed and narrative-focused
- Skeptical of content that could generate negative press
- Values controlled, measured communication over speed
- Protective of executive reputation and shareholder confidence

BEHAVIORAL RULES:
1. Challenge tone: "This reads too alarmist. Our investors will see this as a risk signal."
2. Control the narrative: "We don't 'react' to market rumors. We 'proactively monitor and adapt.'"
3. Push for brand alignment: "Does this match our communications guidelines? Who approved this language?"
4. Worry about leaks: "If this digest gets forwarded outside the organization, how does it read to a journalist?"
5. Be practical about deadlines but uncompromising on brand standards.`,
    behavioralInstructions: "Manages public image and brand narrative. Skeptical of alarmist content. Controls the narrative tightly. Brand-obsessed and worried about leaks and misinterpretation.",
    traits: ["brand-obsessed", "narrative-focused", "skeptical", "protective", "deadline-aware"],
  });

  // ─── Scenarios ─────────────────────────────────────────────────────────────

  const riskIntelScenario = await storage.createScenario({
    title: "The Risk Intelligence Pitch",
    slug: "risk-intelligence-pitch",
    description: "Pitch and sell a Risk Intelligence Package (newsletters, briefings, real-time alerts) to a multinational healthcare company. Navigate procurement gates, compliance sensitivity, and stakeholder alignment under ticking-clock pressure.",
    briefing: `## Scenario Briefing: The Risk Intelligence Pitch

### Your Role
You are an Account Executive at DataShield Analytics, a specialized risk intelligence firm. Your company provides curated newsletters, executive briefings, and real-time regulatory alerts for the healthcare sector.

### The Client
**MedCore International** — a multinational healthcare company with operations in 30+ countries, $8B revenue, and 45,000 employees. They have existing subscriptions to Bloomberg Terminal and Thomson Reuters but lack specialized healthcare risk intelligence.

### Your Objective
Successfully pitch and sell DataShield's Risk Intelligence Package to MedCore International. The package includes:
- **Weekly Risk Digest**: Curated newsletter covering regulatory changes, supply chain risks, and competitive intelligence
- **Real-time Alerts**: Automated notifications for critical regulatory actions, product recalls, and compliance changes
- **Monthly Executive Briefing**: C-suite-ready summary of strategic risks and opportunities

### Package Pricing
- Standard tier: $75,000/year (digest + monthly briefing)
- Premium tier: $150,000/year (adds real-time alerts + custom dashboards)
- Enterprise tier: $250,000/year (adds dedicated analyst + API access)

### Key Constraints
1. **Budget cycle**: MedCore's fiscal year ends September 30. Any vendor contract must be approved by end of Q2 (March 31) to be budgeted.
2. **Procurement process**: Mandatory 90-day vendor onboarding including security review, legal review, and pilot period.
3. **Recent incident**: A competitor was caught off-guard by an FDA warning letter last month. MedCore's CEO mentioned "supply chain visibility" at the last town hall—this is your opening.
4. **Compliance sensitivity**: Any data feed touching patient-adjacent systems requires HIPAA compliance documentation.
5. **Reputational risk**: MedCore's comms team is allergic to anything that could be seen as "alarmist" by investors or board members.

### Required Deliverables
Before and during this engagement, you must produce:
1. **One-Pager**: A crisp summary for internal stakeholders at MedCore, covering value proposition, scope, constraints, and what "success" means
2. **Email Recap(s)**: Post-meeting notes confirming decisions, next steps, ownership, and what was (and was not) promised
3. **Risk Register**: A log of risks (compliance, procurement, reputational optics), mitigations, owners, and decision points

### Stakeholders You'll Engage
- **Margaret Chen** (VP Procurement & Operations) — The Gatekeeper. Budget authority, skeptical of new vendors.
- **Dr. James Okafor** (Director of Risk Analytics) — The Technical Lead. Evaluates data quality and compliance fit.
- **Sarah Martinez** (Sr. Manager, Strategic Partnerships) — Your Internal Ally. Supportive but needs ammunition.

### Success Criteria
- Advance to a formal pilot proposal by end of the engagement
- Produce all required artifacts at a professional quality level
- Navigate procurement, compliance, and reputational constraints without overcommitting
- Build credibility with all three stakeholders through appropriate channel management`,
    category: "sales",
    difficulty: "advanced",
    roleRequired: "Account Executive",
    seniorityLevel: "IC",
    channels: ["email", "call", "deck_review", "follow_up", "internal_coaching"],
    constraints: {
      procurementStrictness: true,
      complianceSensitivity: true,
      tickingClockPressure: true,
      reputationalRisk: true,
      regulatoryExposure: true,
    },
    requiredArtifacts: ["one_pager", "email_recap", "risk_register"],
    competencies: [
      "stakeholder management",
      "objection handling",
      "consultative selling",
      "written communication",
      "risk assessment",
      "procurement navigation",
      "multi-channel sequencing",
    ],
    learningObjectives: [
      "Navigate complex procurement processes with multiple approval gates",
      "Balance urgency with compliance constraints",
      "Produce professional artifacts under time pressure",
      "Manage conflicting stakeholder priorities",
      "Make irreversible trade-off decisions under uncertainty",
    ],
    clientProfile: {
      name: "MedCore International",
      industry: "Healthcare / Pharmaceuticals",
      size: "$8B revenue, 45,000 employees, 30+ countries",
      background: "Multinational healthcare company with existing Bloomberg and Thomson Reuters subscriptions. Recently exposed to supply chain risk after a competitor received an FDA warning letter.",
    },
    featured: true,
    estimatedSteps: 7,
  });

  const enterpriseSoftwareScenario = await storage.createScenario({
    title: "Selling Enterprise Software",
    slug: "enterprise-software-sale",
    description: "Navigate a complex B2B enterprise software sale through multiple stakeholders—from initial outreach to executive buy-in. Handle procurement, technical evaluation, and internal champion management.",
    briefing: `## Scenario Briefing: Enterprise Software Sale

### Your Role
You are a Senior Account Executive at Velocitas, a B2B SaaS platform that provides AI-powered sales analytics and pipeline management.

### The Client
**Meridian Corp** — a mid-market enterprise ($500M revenue) with a 200-person sales organization experiencing declining close rates and pipeline visibility challenges.

### Your Objective
Close a deal for Velocitas's Enterprise Plan, navigating multiple stakeholders from initial discovery through to contract negotiation.

### Pricing
- Growth tier: $80,000/year (up to 50 users)
- Enterprise tier: $200,000/year (up to 200 users + custom integrations)
- Enterprise Plus: $350,000/year (unlimited users + dedicated CSM + custom ML models)

### Key Constraints
1. **Competitive pressure**: Meridian is also evaluating Clari and Gong
2. **Budget authority**: CFO must approve anything above $100K
3. **Technical bar**: Must integrate with SAP, Salesforce, and custom data warehouse
4. **Timeline pressure**: Board meeting in 6 weeks—VP Sales needs to show progress
5. **Security requirements**: SOC 2 Type II, SSO, data residency in US/EU

### Required Deliverables
1. **Discovery Summary**: Key findings, pain points, and recommended approach
2. **Email Recap(s)**: Post-call recaps with clear next steps
3. **One-Pager**: Executive summary for the CFO

### Stakeholders
- **Richard Thornton** (CFO) — Economic buyer, numbers-driven
- **Priya Sharma** (Head of IT) — Technical evaluator, security-focused
- **David Kim** (VP Sales Ops) — Internal champion, urgency-driven`,
    category: "sales",
    difficulty: "intermediate",
    roleRequired: "Account Executive",
    seniorityLevel: "IC",
    channels: ["email", "call", "deck_review", "follow_up", "internal_coaching"],
    constraints: {
      procurementStrictness: true,
      complianceSensitivity: false,
      tickingClockPressure: true,
      reputationalRisk: false,
      regulatoryExposure: false,
    },
    requiredArtifacts: ["one_pager", "email_recap"],
    competencies: [
      "discovery",
      "consultative selling",
      "technical credibility",
      "executive communication",
      "competitive positioning",
      "multi-stakeholder navigation",
    ],
    learningObjectives: [
      "Conduct effective multi-stakeholder discovery",
      "Build and leverage an internal champion",
      "Navigate technical and financial objections",
      "Sequence touchpoints across channels effectively",
      "Produce professional sales artifacts",
    ],
    clientProfile: {
      name: "Meridian Corp",
      industry: "Enterprise Technology",
      size: "$500M revenue, 2,000 employees",
      background: "Mid-market enterprise with declining sales close rates. 200-person sales org with poor pipeline visibility. Currently evaluating multiple solutions.",
    },
    featured: true,
    estimatedSteps: 6,
  });

  const biopharmaDigestScenario = await storage.createScenario({
    title: "Biopharma News Digest Service",
    slug: "biopharma-news-digest",
    description: "Sell a specialized news digest service to a multinational pharmaceutical company. Navigate strict compliance requirements, brand sensitivity, and multi-stakeholder editorial review processes.",
    briefing: `## Scenario Briefing: Biopharma News Digest Service

### Your Role
You are an Agency Account Lead at Horizon Intelligence, a specialized content agency that produces curated news digests, research summaries, and intelligence reports for the pharmaceutical industry.

### The Client
**NovaCure Therapeutics** — a top-20 global pharmaceutical company focused on oncology and rare diseases. They need a better way to keep their leadership informed about competitive intelligence, regulatory developments, and market signals.

### Your Objective
Sell and onboard NovaCure onto Horizon Intelligence's Premium Digest Service, which includes:
- **Daily Intelligence Brief**: Curated news, regulatory updates, and competitive signals
- **Weekly Deep Dive**: In-depth analysis piece on one strategic topic
- **Monthly Board Report**: Executive-ready summary of key developments and strategic implications

### Pricing
- Standard: $120,000/year (daily brief + weekly analysis)
- Premium: $220,000/year (adds monthly board report + custom topics)
- Enterprise: $400,000/year (adds dedicated editorial team + real-time Slack/Teams alerts)

### Key Constraints
1. **Medical accuracy**: All content must pass CMO review for scientific accuracy and regulatory language
2. **Brand sensitivity**: Communications team controls all externally-facing language and tone
3. **Multi-geography**: Content must account for FDA, EMA, and PMDA regulatory contexts
4. **Compliance**: Cannot surface pre-publication clinical data or embargoed information
5. **Reputational risk**: Digest must not appear "alarmist" to investors or board members
6. **Template requirements**: NovaCure has strict formatting guidelines for all internal documents

### Required Deliverables
1. **Newsletter Brief** (sample): Demonstrate the digest format and editorial approach
2. **Client-Facing Summary Email**: Confirm scope, approach, and editorial standards
3. **One-Pager**: Internal alignment document for NovaCure's leadership team
4. **Risk Register** (optional): If compliance/reputational constraints are enabled

### Stakeholders
- **Dr. Elena Vasquez** (CMO) — Reviews all content for medical accuracy. Zero tolerance for exaggerated claims.
- **Tom Bradley** (Global Head of Comms) — Controls the narrative. Worried about brand risk and leaks.
- **Sarah Martinez** (Sr. Manager, Strategic Partnerships) — Your internal champion at NovaCure.`,
    category: "sales",
    difficulty: "advanced",
    roleRequired: "Agency Account Lead",
    seniorityLevel: "Manager",
    channels: ["email", "call", "deck_review", "follow_up", "internal_coaching"],
    constraints: {
      procurementStrictness: true,
      complianceSensitivity: true,
      tickingClockPressure: false,
      reputationalRisk: true,
      regulatoryExposure: true,
    },
    requiredArtifacts: ["one_pager", "email_recap", "newsletter_brief"],
    competencies: [
      "editorial judgment",
      "regulatory awareness",
      "brand sensitivity",
      "stakeholder management",
      "written communication",
      "consultative selling",
    ],
    learningObjectives: [
      "Navigate strict compliance and editorial review processes",
      "Balance scientific accuracy with compelling narrative",
      "Manage brand-sensitive stakeholders",
      "Produce publication-quality content under constraints",
      "Adapt messaging across regulatory jurisdictions",
    ],
    clientProfile: {
      name: "NovaCure Therapeutics",
      industry: "Pharmaceuticals / Oncology",
      size: "Top-20 global pharma, $15B revenue, 35,000 employees",
      background: "Global pharmaceutical company focused on oncology and rare diseases. Needs better competitive intelligence and regulatory monitoring across FDA, EMA, and PMDA jurisdictions.",
    },
    featured: true,
    estimatedSteps: 6,
  });

  // ─── Link Personas to Scenarios ────────────────────────────────────────────

  // Risk Intelligence Pitch
  await storage.linkPersonaToScenario(riskIntelScenario.id, gatekeeper.id, "The Gatekeeper — Budget authority", 2);
  await storage.linkPersonaToScenario(riskIntelScenario.id, techLead.id, "The Technical Lead — Data & compliance evaluator", 3);
  await storage.linkPersonaToScenario(riskIntelScenario.id, internalAlly.id, "The Internal Ally — Needs ammunition to sell internally", 1);

  // Enterprise Software Sale
  await storage.linkPersonaToScenario(enterpriseSoftwareScenario.id, economicBuyer.id, "Economic Buyer — CFO, final budget authority", 3);
  await storage.linkPersonaToScenario(enterpriseSoftwareScenario.id, technicalEvaluator.id, "Technical Evaluator — IT architecture & security", 2);
  await storage.linkPersonaToScenario(enterpriseSoftwareScenario.id, internalChampion.id, "Internal Champion — VP Sales Ops, initiated evaluation", 1);

  // Biopharma News Digest
  await storage.linkPersonaToScenario(biopharmaDigestScenario.id, pharmaEditor.id, "Medical Reviewer — CMO, content accuracy gatekeeper", 2);
  await storage.linkPersonaToScenario(biopharmaDigestScenario.id, pharmaCommsLead.id, "Communications Gatekeeper — Brand narrative control", 3);
  await storage.linkPersonaToScenario(biopharmaDigestScenario.id, internalAlly.id, "Internal Champion — Strategic Partnerships lead", 1);

  // ─── Templates ─────────────────────────────────────────────────────────────

  await storage.createTemplate({
    name: "Executive One-Pager",
    type: "one_pager",
    category: "sales",
    roleMapping: "Enterprise AE / Account Lead",
    content: `# [Title: Solution Name for Client]

## The Challenge
[2-3 sentences describing the client's problem and why it matters now]

## Our Solution
[2-3 bullet points covering what we deliver]

## Key Benefits
- **[Benefit 1]**: [One sentence with quantification if possible]
- **[Benefit 2]**: [One sentence]
- **[Benefit 3]**: [One sentence]

## Scope & Pricing
[Tier recommended, annual cost, what's included]

## Timeline & Next Steps
- [Step 1 with date]
- [Step 2 with date]
- [Step 3 with date]

## Risks & Mitigations
| Risk | Mitigation | Owner |
|------|-----------|-------|
| [Risk 1] | [Mitigation] | [Owner] |`,
    styleGuide: "Keep it to one page. Use active voice. Quantify benefits where possible. No jargon. The reader should understand the value proposition in 60 seconds.",
    isActive: true,
  });

  await storage.createTemplate({
    name: "Post-Meeting Email Recap",
    type: "email_recap",
    category: "sales",
    roleMapping: "All sales roles",
    content: `Subject: [Meeting Topic] — Recap & Next Steps

Hi [Name],

Thank you for [the call / meeting / your time] today. Below is a summary of what we discussed, decisions made, and agreed next steps.

## Key Discussion Points
- [Point 1]
- [Point 2]
- [Point 3]

## Decisions Made
- [Decision 1]
- [Decision 2]

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action 1] | [Owner] | [Date] |
| [Action 2] | [Owner] | [Date] |

## What Was NOT Discussed / Deferred
- [Item 1]
- [Item 2]

Please let me know if I've missed anything or if any of the above needs correction.

Best regards,
[Your name]`,
    styleGuide: "Be precise about what was promised and what was NOT promised. Tone should be professional but warm. Always include a 'What was NOT discussed' section to prevent scope creep and manage expectations.",
    isActive: true,
  });

  await storage.createTemplate({
    name: "Risk Register",
    type: "risk_register",
    category: "sales",
    roleMapping: "Enterprise AE / Account Lead",
    content: `# Risk Register: [Engagement Name]

Last Updated: [Date]

## Active Risks

| # | Risk | Category | Severity | Likelihood | Impact | Mitigation | Owner | Status | Decision Date |
|---|------|----------|----------|------------|--------|-----------|-------|--------|---------------|
| 1 | [Description] | [Compliance/Procurement/Reputational/Technical] | [High/Medium/Low] | [High/Medium/Low] | [Description] | [Mitigation plan] | [Name] | [Open/Mitigated/Accepted] | [Date] |

## Resolved Risks
| # | Risk | Resolution | Date Resolved |
|---|------|-----------|---------------|
| | | | |

## Notes
- [Any contextual notes about the risk landscape]`,
    styleGuide: "Keep entries concise but specific. Every risk must have an owner and a mitigation. Update weekly during active engagements. Severity = consequence if risk materializes; Likelihood = probability of occurrence.",
    isActive: true,
  });

  await storage.createTemplate({
    name: "Newsletter / Intelligence Brief",
    type: "newsletter_brief",
    category: "sales",
    roleMapping: "Agency Account Lead — Biopharma",
    content: `# [Intelligence Brief Title] — [Date]

## Top Stories This Week

### 1. [Headline]
**Source**: [Publication] | **Relevance**: [High/Medium]

[2-3 sentence summary of the development and its implications]

**Impact Assessment**: [Brief analysis of what this means for the client]

---

### 2. [Headline]
**Source**: [Publication] | **Relevance**: [High/Medium]

[2-3 sentence summary]

**Impact Assessment**: [Brief analysis]

---

## Regulatory Watch
- **[Agency]**: [Brief update on regulatory development]
- **[Agency]**: [Brief update]

## Competitive Intelligence
- [Competitor activity worth noting]

## Upcoming Events & Deadlines
- [Date]: [Event/deadline]

---
*This brief is prepared for internal use only. All claims are sourced and verifiable. Contact [editor] for source documentation.*`,
    styleGuide: "Balanced, factual tone. Never sensational. All claims must be sourced. Use 'Impact Assessment' to connect news to client strategy without speculation. Include regulatory disclaimers. Suitable for forwarding to C-suite.",
    isActive: true,
  });

  // Create default user config
  await storage.upsertUserConfig({
    role: "Account Executive",
    seniorityLevel: "IC",
    preferredMode: "practice",
    activeChannels: ["email", "call", "deck_review", "follow_up"],
    constraintToggles: {
      procurementStrictness: false,
      complianceSensitivity: false,
      tickingClockPressure: false,
    },
    activeTemplateIds: [],
  });

  return { message: "Database seeded successfully", seeded: true };
}
