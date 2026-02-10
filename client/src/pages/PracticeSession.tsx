import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Send,
  ChevronRight,
  FileText,
  Mail,
  Phone,
  PhoneCall,
  Mic,
  Presentation,
  MessageSquare,
  Users,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
  CheckCircle2,
  Circle,
  ArrowRight,
  BarChart3,
  Target,
  Settings,
  Info,
  BookOpen,
  HelpCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface Persona {
  id: number;
  name: string;
  role: string;
  personaType: string;
  avatarInitials: string;
  avatarColor: string;
  description: string;
  traits: string[];
}

interface ScenarioPersona {
  id: number;
  scenarioId: number;
  personaId: number;
  roleInScenario: string;
  introduceAtStep: number;
  persona: Persona;
}

interface Scenario {
  id: number;
  title: string;
  description: string;
  totalSteps: number;
  channels: string[];
  requiredArtifacts: string[];
}

interface Session {
  id: number;
  scenarioId: number;
  mode: "practice" | "assessment";
  status: string;
  currentStep: number;
  currentChannel: string;
  scenario: Scenario;
}

interface Message {
  id: number;
  sessionId: number;
  senderType: "user" | "persona" | "system";
  senderName: string;
  content: string;
  channel: string;
  createdAt: string;
  step: number;
  personaId?: number | null;
}

interface Artifact {
  id: number;
  sessionId: number;
  type: string;
  title: string;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Channel config
// ---------------------------------------------------------------------------

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: "Email", icon: Mail },
  call: { label: "Call", icon: Phone },
  deck_review: { label: "Deck Review", icon: Presentation },
  follow_up: { label: "Follow-Up", icon: MessageSquare },
  internal_coaching: { label: "Internal Coaching", icon: Users },
  meeting: { label: "Meeting", icon: Users },
};

// ---------------------------------------------------------------------------
// Artifact type config
// ---------------------------------------------------------------------------

const ARTIFACT_TYPES: Record<string, string> = {
  one_pager: "One-Pager",
  email_recap: "Email Recap",
  risk_register: "Risk Register",
  meeting_agenda: "Meeting Agenda",
  deck: "Deck/Presentation",
  newsletter_brief: "Newsletter Brief",
  custom: "Custom",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChannelIcon(channel: string) {
  const config = CHANNEL_CONFIG[channel];
  return config ? config.icon : MessageSquare;
}

function getChannelLabel(channel: string) {
  const config = CHANNEL_CONFIG[channel];
  return config ? config.label : channel;
}

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMessageContent(content: string) {
  // Simple markdown-like formatting: **bold**, line breaks
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Handle line breaks
    const lines = part.split("\n");
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ));
  });
}

// ---------------------------------------------------------------------------
// Call-specific UI components
// ---------------------------------------------------------------------------

/** Pulsing "Live Call" banner shown when the current channel is "call" */
function CallInProgressBanner({ personaName }: { personaName?: string }) {
  return (
    <div className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <PhoneCall className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-green-800 dark:text-green-200">
              Live Call in Progress
            </div>
            {personaName && (
              <div className="text-xs text-green-600 dark:text-green-400">
                Speaking with {personaName}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <Info className="h-3.5 w-3.5" />
          <span>Type what you would say out loud</span>
        </div>
      </div>
    </div>
  );
}

/** Empty state shown when the call channel has no messages yet */
function CallEmptyState({ personaName }: { personaName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
          <PhoneCall className="h-10 w-10 text-green-600 dark:text-green-400 animate-pulse" />
        </div>
        <span className="absolute top-0 right-0 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
        </span>
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-base font-medium text-foreground">
          Call Connected{personaName ? ` with ${personaName}` : ""}
        </p>
        <p className="text-sm max-w-xs">
          This is a simulated live call. Type what you would say out loud and the
          stakeholder will respond in real time.
        </p>
      </div>
      <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-4 py-2 text-xs">
        <Mic className="h-3.5 w-3.5 text-green-600" />
        <span>Start by introducing yourself or responding to the stakeholder</span>
      </div>
    </div>
  );
}

/** Info callout explaining the call simulation */
function CallSimulationInfo() {
  return (
    <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 mx-4 mt-3 mb-1">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
      <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
        <span className="font-medium">Simulated call:</span> This is a text-based call
        simulation. Type your spoken responses as if you were on a real phone call. The
        stakeholder will react to your tone, arguments, and approach just like in a live
        conversation.
      </div>
    </div>
  );
}

/** Scenario briefing panel shown at the start of a session */
function ScenarioBriefingPanel({
  scenario,
  activePersona,
  activeRole,
  currentChannel,
  scenarioPersonas,
}: {
  scenario: Scenario;
  activePersona?: Persona;
  activeRole?: string;
  currentChannel: string;
  scenarioPersonas: ScenarioPersona[];
}) {
  const channelLabel = getChannelLabel(currentChannel);

  return (
    <div className="mx-4 mt-4 mb-2 space-y-3">
      {/* Briefing Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <BookOpen className="h-5 w-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Scenario Briefing
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Read this before you begin — your role, objective, and who you'll be speaking with.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Your Role & Objective */}
          <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
              Your Role
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              You are stepping into the role of <span className="font-semibold">{scenario.title.includes("Biopharma") ? "Agency Account Lead at Horizon Intelligence" : scenario.title.includes("Enterprise") ? "Senior Account Executive at Velocitas" : "Account Executive at DataShield Analytics"}</span>. Your goal is to navigate this {scenario.description.toLowerCase().includes("sell") ? "sales engagement" : "scenario"} by communicating with stakeholders across multiple channels.
            </p>
          </div>

          {/* Stakeholders */}
          {scenarioPersonas.length > 0 && (
            <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                Stakeholders You'll Meet
              </div>
              <div className="space-y-2">
                {scenarioPersonas.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: sp.persona.avatarColor }}
                    >
                      {sp.persona.avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {sp.persona.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        — {sp.persona.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required artifacts */}
          {scenario.requiredArtifacts.length > 0 && (
            <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                Required Deliverables
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scenario.requiredArtifacts.map((art) => (
                  <Badge key={art} variant="secondary" className="text-xs">
                    {ARTIFACT_TYPES[art] ?? art}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How It Works Card */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <HelpCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              How This Simulation Works
            </h3>
          </div>
        </div>

        <div className="space-y-2.5 text-sm text-foreground">
          <div className="flex items-start gap-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200 shrink-0 mt-0.5">
              1
            </div>
            <p className="leading-relaxed">
              <span className="font-medium">Type your message</span> in the text box below — you're starting on the <Badge variant="outline" className="text-xs mx-0.5 py-0">{channelLabel}</Badge> channel.
              {activePersona && (
                <> You'll be speaking with <span className="font-medium">{activePersona.name}</span>.</>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200 shrink-0 mt-0.5">
              2
            </div>
            <p className="leading-relaxed">
              <span className="font-medium">The stakeholder will respond</span> based on their personality, role, and your approach. Adapt your tone and strategy.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200 shrink-0 mt-0.5">
              3
            </div>
            <p className="leading-relaxed">
              <span className="font-medium">Advance through steps</span> using the footer controls. Each step may change the channel and introduce a new stakeholder.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="h-5 w-5 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-200 shrink-0 mt-0.5">
              4
            </div>
            <p className="leading-relaxed">
              <span className="font-medium">Submit artifacts</span> (one-pagers, emails, etc.) using the panel on the right as you progress through the engagement.
            </p>
          </div>
        </div>
      </div>

      {/* Example conversation preview */}
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Example Exchange
        </div>
        <div className="space-y-3">
          {/* Example user message */}
          <div className="flex justify-end">
            <div className="max-w-[80%]">
              <div className="rounded-2xl rounded-br-md px-3 py-2 bg-primary/80 text-primary-foreground text-xs leading-relaxed">
                Hi {activePersona?.name?.split(" ")[0] ?? "there"}, thank you for making time. I wanted to reach out about how we can help with your {scenario.title.toLowerCase().includes("biopharma") ? "intelligence and monitoring needs" : scenario.title.toLowerCase().includes("enterprise") ? "pipeline visibility challenges" : "risk intelligence needs"}...
              </div>
              <div className="text-right text-[10px] text-muted-foreground mt-0.5">You</div>
            </div>
          </div>
          {/* Example persona response */}
          {activePersona && (
            <div className="flex justify-start gap-2">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-1"
                style={{ backgroundColor: activePersona.avatarColor }}
              >
                {activePersona.avatarInitials}
              </div>
              <div className="max-w-[80%]">
                <div className="rounded-2xl rounded-bl-md px-3 py-2 bg-card border text-xs leading-relaxed">
                  <div className="font-semibold text-foreground mb-0.5 text-[10px]">{activePersona.name}</div>
                  {activePersona.personaType === "cooperative"
                    ? "Thanks for reaching out! I've been looking forward to this conversation. I think there's real potential here, but I'll need some concrete deliverables to take to the leadership team..."
                    : activePersona.personaType === "difficult_skeptical"
                      ? "Appreciate you reaching out. Before we go further, I want to understand exactly what this would cost and what problem it solves that we can't handle internally..."
                      : "Interesting. I have some questions about your methodology and data sources. Can you walk me through how your process works in detail?"
                  }
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{activePersona.name}</div>
              </div>
            </div>
          )}
        </div>
        <div className="text-center mt-3">
          <p className="text-xs text-muted-foreground italic">
            This is an example. Your actual conversation will vary based on your approach.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-2">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-2 text-sm font-medium">
          <ArrowRight className="h-4 w-4" />
          Type your opening message below to begin the simulation
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PracticeSession() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Local state
  const [messageInput, setMessageInput] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [artifactType, setArtifactType] = useState("");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactContent, setArtifactContent] = useState("");
  const [callInfoDismissed, setCallInfoDismissed] = useState(false);

  // Ref for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery<Session>({
    queryKey: ["/api/sessions", sessionId.toString()],
    enabled: sessionId > 0,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/sessions", sessionId.toString(), "messages"],
    enabled: sessionId > 0,
    refetchInterval: false,
  });

  const { data: scenarioPersonas = [] } = useQuery<ScenarioPersona[]>({
    queryKey: ["/api/scenarios", session?.scenarioId?.toString() ?? "0", "personas"],
    enabled: !!session?.scenarioId,
  });

  const { data: artifacts = [] } = useQuery<Artifact[]>({
    queryKey: ["/api/sessions", sessionId.toString(), "artifacts"],
    enabled: sessionId > 0,
  });

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const sendMessageMutation = useMutation({
    mutationFn: async (body: { content: string; channel: string }) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/messages`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", sessionId.toString(), "messages"],
      });
      setMessageInput("");
    },
  });

  const advanceStepMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/advance`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", sessionId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", sessionId.toString(), "messages"],
      });
    },
  });

  const submitArtifactMutation = useMutation({
    mutationFn: async (body: { type: string; title: string; content: string }) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/artifacts`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", sessionId.toString(), "artifacts"],
      });
      setArtifactType("");
      setArtifactTitle("");
      setArtifactContent("");
    },
  });

  const assessmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/assessment`);
      return res.json();
    },
    onSuccess: () => {
      navigate(`/assessment/${sessionId}`);
    },
  });

  // -----------------------------------------------------------------------
  // Auto-scroll on new messages
  // -----------------------------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const scenario = session?.scenario;
  const totalSteps = scenario?.totalSteps ?? 1;
  const currentStep = session?.currentStep ?? 1;
  const currentChannel = session?.currentChannel ?? "email";
  const isCompleted = session?.status === "completed";
  const allStepsDone = currentStep >= totalSteps;
  const requiredArtifacts = scenario?.requiredArtifacts ?? [];
  const submittedArtifactTypes = artifacts.map((a) => a.type);

  // Find the active persona (the one introduced at or before the current step, latest first)
  const activeScenarioPersona = [...scenarioPersonas]
    .filter((sp) => sp.introduceAtStep <= currentStep)
    .sort((a, b) => b.introduceAtStep - a.introduceAtStep)[0];
  const activePersona = activeScenarioPersona?.persona;

  // Persona lookup by id
  const personaMap = new Map<number, Persona>();
  for (const sp of scenarioPersonas) {
    personaMap.set(sp.persona.id, sp.persona);
  }

  // Call channel detection
  const isCallChannel = currentChannel === "call";
  const callMessagesExist = messages.some(
    (m) => m.channel === "call" && m.senderType === "user"
  );

  // Filtered messages
  const filteredMessages =
    channelFilter === "all"
      ? messages
      : messages.filter((m) => m.channel === channelFilter);

  // Progress percentage
  const progressPct = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleSendMessage() {
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    sendMessageMutation.mutate({ content: trimmed, channel: currentChannel });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleSubmitArtifact() {
    if (!artifactType || !artifactTitle.trim() || !artifactContent.trim()) return;
    submitArtifactMutation.mutate({
      type: artifactType,
      title: artifactTitle.trim(),
      content: artifactContent.trim(),
    });
  }

  // -----------------------------------------------------------------------
  // Loading / error states
  // -----------------------------------------------------------------------

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-destructive font-medium">Failed to load session</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const ChannelIcon = getChannelIcon(currentChannel);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* ============================================================= */}
        {/* SESSION HEADER                                                 */}
        {/* ============================================================= */}
        <header className="border-b bg-card px-4 py-3 md:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Left: title + meta */}
            <div className="flex items-center gap-3 min-w-0">
              <Target className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-lg font-semibold truncate">
                {scenario?.title ?? "Session"}
              </h1>
              <Badge variant={session.mode === "assessment" ? "destructive" : "default"}>
                {session.mode === "assessment" ? "Assessment" : "Practice"}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {session.status}
              </Badge>
            </div>

            {/* Right: step + channel */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Settings className="h-4 w-4" />
                <span>
                  Step {currentStep} / {totalSteps}
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className={`flex items-center gap-1.5 ${
                isCallChannel ? "text-green-600 dark:text-green-400 font-medium" : ""
              }`}>
                <ChannelIcon className="h-4 w-4" />
                <span>{getChannelLabel(currentChannel)}</span>
                {isCallChannel && !isCompleted && (
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <Progress value={progressPct} className="h-2" />
          </div>
        </header>

        {/* ============================================================= */}
        {/* MAIN CONTENT: LEFT + RIGHT PANELS                             */}
        {/* ============================================================= */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* ----------------------------------------------------------- */}
          {/* LEFT PANEL - CONVERSATION THREAD                            */}
          {/* ----------------------------------------------------------- */}
          <div className="flex-1 lg:w-2/3 flex flex-col border-r min-h-0">
            {/* Call-in-progress banner */}
            {isCallChannel && !isCompleted && (
              <CallInProgressBanner personaName={activePersona?.name} />
            )}

            {/* Call simulation info (shown once until dismissed) */}
            {isCallChannel && !callInfoDismissed && !isCompleted && (
              <CallSimulationInfo />
            )}

            {/* Messages area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-2">
                {messagesLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Briefing panel shown when no user messages exist yet */}
                {!messagesLoading && !isCallChannel && !filteredMessages.some(m => m.senderType === "user") && scenario && (
                  <ScenarioBriefingPanel
                    scenario={scenario}
                    activePersona={activePersona}
                    activeRole={activeScenarioPersona?.roleInScenario}
                    currentChannel={currentChannel}
                    scenarioPersonas={scenarioPersonas}
                  />
                )}

                {/* Default empty state for non-call channels when filtering a specific channel with no messages */}
                {!messagesLoading && filteredMessages.length === 0 && !isCallChannel && messages.some(m => m.senderType === "user") && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8" />
                    <p className="text-sm">No messages in this channel yet.</p>
                  </div>
                )}

                {/* Call-specific empty state */}
                {!messagesLoading && filteredMessages.length === 0 && isCallChannel && (
                  <CallEmptyState personaName={activePersona?.name} />
                )}

                {filteredMessages.map((msg) => {
                  const ChannelBadgeIcon = getChannelIcon(msg.channel);

                  // ------ SYSTEM MESSAGE ------
                  if (msg.senderType === "system") {
                    const isCallSysMsg = msg.channel === "call";
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className={`max-w-lg border rounded-lg px-4 py-2.5 text-center text-sm ${
                          isCallSysMsg
                            ? "bg-green-50/80 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                            : "bg-muted/50 text-muted-foreground"
                        }`}>
                          <div className={`font-medium text-xs uppercase tracking-wide mb-1 ${
                            isCallSysMsg
                              ? "text-green-600 dark:text-green-400 flex items-center justify-center gap-1.5"
                              : "text-muted-foreground/70"
                          }`}>
                            {isCallSysMsg && <PhoneCall className="h-3 w-3" />}
                            {isCallSysMsg ? "Call Started" : "System"}
                          </div>
                          <div className="leading-relaxed">
                            {renderMessageContent(msg.content)}
                          </div>
                          <div className={`flex items-center justify-center gap-2 mt-2 text-xs ${
                            isCallSysMsg ? "text-green-500/70 dark:text-green-500/50" : "text-muted-foreground/50"
                          }`}>
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(msg.createdAt)}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              isCallSysMsg ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400" : ""
                            }`}>
                              <ChannelBadgeIcon className="h-2.5 w-2.5 mr-1" />
                              {getChannelLabel(msg.channel)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ------ USER MESSAGE ------
                  if (msg.senderType === "user") {
                    const isCallMsg = msg.channel === "call";
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[75%] md:max-w-[60%]">
                          {isCallMsg && (
                            <div className="flex items-center justify-end gap-1.5 mb-1 text-xs text-green-600 dark:text-green-400 font-medium">
                              <Mic className="h-3 w-3" />
                              <span>You said:</span>
                            </div>
                          )}
                          <div className={`rounded-2xl rounded-br-md px-4 py-2.5 ${
                            isCallMsg
                              ? "bg-green-600 text-white dark:bg-green-700"
                              : "bg-primary text-primary-foreground"
                          }`}>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {renderMessageContent(msg.content)}
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{msg.senderName}</span>
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(msg.createdAt)}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              isCallMsg ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400" : ""
                            }`}>
                              <ChannelBadgeIcon className="h-2.5 w-2.5 mr-1" />
                              {getChannelLabel(msg.channel)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ------ PERSONA MESSAGE ------
                  const persona = msg.personaId ? personaMap.get(msg.personaId) : null;
                  const initials = persona?.avatarInitials ?? msg.senderName.slice(0, 2).toUpperCase();
                  const avatarColor = persona?.avatarColor ?? "#6b7280";
                  const isCallMsg = msg.channel === "call";

                  return (
                    <div key={msg.id} className="flex justify-start gap-3">
                      {/* Avatar */}
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 relative"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initials}
                        {isCallMsg && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                            <Phone className="h-3 w-3 text-green-600 dark:text-green-400 bg-white dark:bg-gray-900 rounded-full p-0.5" />
                          </span>
                        )}
                      </div>
                      <div className="max-w-[75%] md:max-w-[60%]">
                        {isCallMsg && (
                          <div className="flex items-center gap-1.5 mb-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <Phone className="h-3 w-3" />
                            <span>{msg.senderName} says:</span>
                          </div>
                        )}
                        <div className={`rounded-2xl rounded-bl-md px-4 py-2.5 ${
                          isCallMsg
                            ? "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800"
                            : "bg-card border"
                        }`}>
                          {!isCallMsg && (
                            <div className="text-xs font-semibold mb-1 text-foreground">
                              {msg.senderName}
                            </div>
                          )}
                          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                            {renderMessageContent(msg.content)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(msg.createdAt)}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                            isCallMsg ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400" : ""
                          }`}>
                            <ChannelBadgeIcon className="h-2.5 w-2.5 mr-1" />
                            {getChannelLabel(msg.channel)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input area */}
            <div className={`border-t p-3 md:p-4 ${
              isCallChannel && !isCompleted
                ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                : "bg-card"
            }`}>
              {isCompleted ? (
                <div className="text-center text-sm text-muted-foreground py-2">
                  {isCallChannel ? "Call ended. No more messages can be sent." : "This session is completed. No more messages can be sent."}
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  {isCallChannel && (
                    <div className="flex items-center justify-center h-10 w-10 shrink-0">
                      <Mic className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  )}
                  <Textarea
                    placeholder={
                      isCallChannel
                        ? "What would you say next? (Type your spoken response...)"
                        : `Type your message (${getChannelLabel(currentChannel)} channel)...`
                    }
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      if (isCallChannel && !callInfoDismissed) {
                        setCallInfoDismissed(true);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className={`resize-none flex-1 min-h-[2.5rem] ${
                      isCallChannel
                        ? "border-green-300 dark:border-green-700 focus-visible:ring-green-500"
                        : ""
                    }`}
                    disabled={sendMessageMutation.isPending}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={
                          !messageInput.trim() || sendMessageMutation.isPending
                        }
                        className={isCallChannel ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600" : ""}
                      >
                        {sendMessageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isCallChannel ? "Speak (send response)" : "Send message"}</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {sendMessageMutation.isError && (
                <p className="text-xs text-destructive mt-2">
                  Failed to send message. Please try again.
                </p>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* RIGHT PANEL - SESSION INFO & ARTIFACTS                       */}
          {/* ----------------------------------------------------------- */}
          <div className="lg:w-1/3 flex flex-col min-h-0 overflow-y-auto">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* ----- Active Persona Card ----- */}
                {activePersona && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ backgroundColor: activePersona.avatarColor }}
                        >
                          {activePersona.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {activePersona.name}
                          </CardTitle>
                          <CardDescription className="truncate">
                            {activePersona.role}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {activePersona.personaType}
                        </Badge>
                        {activeScenarioPersona?.roleInScenario && (
                          <Badge variant="outline" className="text-xs">
                            {activeScenarioPersona.roleInScenario}
                          </Badge>
                        )}
                      </div>
                      {activePersona.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {activePersona.description}
                        </p>
                      )}
                      {activePersona.traits && activePersona.traits.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {activePersona.traits.map((trait) => (
                            <Badge
                              key={trait}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-normal"
                            >
                              {trait}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ----- Channel Navigation ----- */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Channel Filter
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant={channelFilter === "all" ? "default" : "outline"}
                        onClick={() => setChannelFilter("all")}
                        className="text-xs h-7"
                      >
                        All
                      </Button>
                      {(scenario?.channels ?? []).map((ch) => {
                        const ChIcon = getChannelIcon(ch);
                        return (
                          <Button
                            key={ch}
                            size="sm"
                            variant={channelFilter === ch ? "default" : "outline"}
                            onClick={() => setChannelFilter(ch)}
                            className="text-xs h-7"
                          >
                            <ChIcon className="h-3 w-3 mr-1" />
                            {getChannelLabel(ch)}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* ----- Required Artifacts Checklist ----- */}
                {requiredArtifacts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Required Artifacts
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {submittedArtifactTypes.filter((t) =>
                          requiredArtifacts.includes(t)
                        ).length}{" "}
                        of {requiredArtifacts.length} submitted
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {requiredArtifacts.map((artType) => {
                          const isSubmitted = submittedArtifactTypes.includes(artType);
                          return (
                            <li
                              key={artType}
                              className="flex items-center gap-2 text-sm"
                            >
                              {isSubmitted ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span
                                className={
                                  isSubmitted
                                    ? "text-foreground line-through opacity-60"
                                    : "text-foreground"
                                }
                              >
                                {ARTIFACT_TYPES[artType] ?? artType}
                              </span>
                              {isSubmitted && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 ml-auto"
                                >
                                  Submitted
                                </Badge>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* ----- Artifact Submission Panel ----- */}
                {!isCompleted && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Submit Artifact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Artifact Type
                        </label>
                        <Select value={artifactType} onValueChange={setArtifactType}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ARTIFACT_TYPES).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Title
                        </label>
                        <Input
                          placeholder="Artifact title..."
                          value={artifactTitle}
                          onChange={(e) => setArtifactTitle(e.target.value)}
                          disabled={submitArtifactMutation.isPending}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Content
                        </label>
                        <Textarea
                          placeholder="Write the artifact content here..."
                          value={artifactContent}
                          onChange={(e) => setArtifactContent(e.target.value)}
                          rows={8}
                          className="resize-y"
                          disabled={submitArtifactMutation.isPending}
                        />
                      </div>

                      <Button
                        onClick={handleSubmitArtifact}
                        disabled={
                          !artifactType ||
                          !artifactTitle.trim() ||
                          !artifactContent.trim() ||
                          submitArtifactMutation.isPending
                        }
                        className="w-full"
                      >
                        {submitArtifactMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Submit Artifact
                          </>
                        )}
                      </Button>

                      {submitArtifactMutation.isError && (
                        <p className="text-xs text-destructive">
                          Failed to submit artifact. Please try again.
                        </p>
                      )}

                      {submitArtifactMutation.isSuccess && (
                        <p className="text-xs text-green-600">
                          Artifact submitted successfully!
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ----- Submitted Artifacts List ----- */}
                {artifacts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Submitted Artifacts ({artifacts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {artifacts.map((art) => (
                          <li
                            key={art.id}
                            className="flex items-start gap-2 text-sm border rounded-md p-2"
                          >
                            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{art.title}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {ARTIFACT_TYPES[art.type] ?? art.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(art.createdAt)}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* ============================================================= */}
        {/* STEP CONTROLS FOOTER                                           */}
        {/* ============================================================= */}
        {!isCompleted && (
          <footer className="border-t bg-card px-4 py-3 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Step progress indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalSteps }, (_, i) => {
                    const stepNum = i + 1;
                    const isActive = stepNum === currentStep;
                    const isDone = stepNum < currentStep;
                    return (
                      <Tooltip key={stepNum}>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-2.5 w-2.5 rounded-full transition-colors ${
                              isActive
                                ? "bg-primary ring-2 ring-primary/30"
                                : isDone
                                  ? "bg-primary/60"
                                  : "bg-muted-foreground/30"
                            }`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          Step {stepNum}
                          {isActive ? " (current)" : isDone ? " (done)" : ""}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <span className="ml-2">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {!allStepsDone && (
                  <Button
                    onClick={() => advanceStepMutation.mutate()}
                    disabled={advanceStepMutation.isPending}
                    variant="outline"
                  >
                    {advanceStepMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Advancing...
                      </>
                    ) : (
                      <>
                        Advance to Next Step
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                )}

                {allStepsDone && (
                  <Button
                    onClick={() => assessmentMutation.mutate()}
                    disabled={assessmentMutation.isPending}
                  >
                    {assessmentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating Assessment...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Complete & Get Assessment
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {advanceStepMutation.isError && (
              <p className="text-xs text-destructive mt-2">
                Failed to advance step. Please try again.
              </p>
            )}
            {assessmentMutation.isError && (
              <p className="text-xs text-destructive mt-2">
                Failed to generate assessment. Please try again.
              </p>
            )}
          </footer>
        )}
      </div>
    </TooltipProvider>
  );
}
