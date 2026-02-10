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
  timestamp: string;
  personaId?: number | null;
}

interface Artifact {
  id: number;
  sessionId: number;
  type: string;
  title: string;
  content: string;
  submittedAt: string;
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
              <div className="flex items-center gap-1.5">
                <ChannelIcon className="h-4 w-4" />
                <span>{getChannelLabel(currentChannel)}</span>
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
            {/* Messages area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-2">
                {messagesLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!messagesLoading && filteredMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                )}

                {filteredMessages.map((msg) => {
                  const ChannelBadgeIcon = getChannelIcon(msg.channel);

                  // ------ SYSTEM MESSAGE ------
                  if (msg.senderType === "system") {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="max-w-lg bg-muted/50 border rounded-lg px-4 py-2.5 text-center text-sm text-muted-foreground">
                          <div className="font-medium text-xs uppercase tracking-wide mb-1 text-muted-foreground/70">
                            System
                          </div>
                          <div className="leading-relaxed">
                            {renderMessageContent(msg.content)}
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground/50">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(msg.timestamp)}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
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
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[75%] md:max-w-[60%]">
                          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5">
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {renderMessageContent(msg.content)}
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{msg.senderName}</span>
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(msg.timestamp)}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
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

                  return (
                    <div key={msg.id} className="flex justify-start gap-3">
                      {/* Avatar */}
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initials}
                      </div>
                      <div className="max-w-[75%] md:max-w-[60%]">
                        <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-2.5">
                          <div className="text-xs font-semibold mb-1 text-foreground">
                            {msg.senderName}
                          </div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                            {renderMessageContent(msg.content)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(msg.timestamp)}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
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
            <div className="border-t bg-card p-3 md:p-4">
              {isCompleted ? (
                <div className="text-center text-sm text-muted-foreground py-2">
                  This session is completed. No more messages can be sent.
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    placeholder={`Type your message (${getChannelLabel(currentChannel)} channel)...`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="resize-none flex-1 min-h-[2.5rem]"
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
                      >
                        {sendMessageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send message</TooltipContent>
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
                                  {formatTimestamp(art.submittedAt)}
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
