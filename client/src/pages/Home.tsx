import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Target,
  Settings,
  FileText,
  Play,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Presentation,
  MessageSquare,
  Users,
  Shield,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
  BookOpen,
  BarChart3,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types (derived from schema) ───────────────────────────────────────────

interface Scenario {
  id: number;
  title: string;
  slug: string;
  description: string;
  briefing: string;
  category: string;
  difficulty: "intro" | "intermediate" | "advanced";
  roleRequired: string;
  seniorityLevel: string;
  channels: string[];
  constraints: {
    procurementStrictness: boolean;
    complianceSensitivity: boolean;
    tickingClockPressure: boolean;
    reputationalRisk: boolean;
    regulatoryExposure: boolean;
  };
  requiredArtifacts: string[];
  competencies: string[];
  learningObjectives: string[];
  clientProfile: {
    name: string;
    industry: string;
    size: string;
    background: string;
  };
  featured: boolean;
  estimatedSteps: number;
  createdAt: string;
}

interface Template {
  id: number;
  name: string;
  type: string;
  category: string;
  roleMapping: string | null;
  content: string;
  styleGuide: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Session {
  id: number;
  scenarioId: number;
  mode: "practice" | "assessment";
  status: "briefing" | "active" | "paused" | "awaiting_review" | "completed";
  currentStep: number;
  currentChannel: string;
  userRole: string;
  userSeniority: string;
  config: {
    procurementStrictness: boolean;
    complianceSensitivity: boolean;
    tickingClockPressure: boolean;
  };
  startedAt: string;
  completedAt: string | null;
}

interface UserConfig {
  id: number;
  role: string;
  seniorityLevel: string;
  preferredMode: "practice" | "assessment";
  activeChannels: string[];
  constraintToggles: {
    procurementStrictness: boolean;
    complianceSensitivity: boolean;
    tickingClockPressure: boolean;
  };
  activeTemplateIds: number[];
  updatedAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const ROLES = [
  { value: "Account Executive", label: "Account Executive" },
  { value: "Sales Manager", label: "Sales Manager" },
  { value: "Agency Account Lead", label: "Agency Account Lead" },
];

const SENIORITY_LEVELS = [
  { value: "IC", label: "IC (Individual Contributor)" },
  { value: "Manager", label: "Manager" },
  { value: "Director", label: "Director" },
];

const CHANNELS = [
  { key: "email", label: "Email", icon: Mail },
  { key: "call", label: "Call", icon: Phone },
  { key: "deck_review", label: "Deck Review", icon: Presentation },
  { key: "follow_up", label: "Follow-up", icon: MessageSquare },
  { key: "internal_coaching", label: "Internal Coaching", icon: Users },
];

const CONSTRAINTS = [
  {
    key: "procurementStrictness" as const,
    label: "Procurement Strictness",
    icon: Shield,
    description: "Enforce strict procurement gates and vendor onboarding timelines",
  },
  {
    key: "complianceSensitivity" as const,
    label: "Compliance Sensitivity",
    icon: AlertTriangle,
    description: "Heighten compliance requirements and regulatory language scrutiny",
  },
  {
    key: "tickingClockPressure" as const,
    label: "Ticking-Clock Pressure",
    icon: Clock,
    description: "Add time constraints and deadline urgency to stakeholder interactions",
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  intro: "bg-green-100 text-green-800 border-green-200",
  intermediate: "bg-amber-100 text-amber-800 border-amber-200",
  advanced: "bg-red-100 text-red-800 border-red-200",
};

const ARTIFACT_LABELS: Record<string, string> = {
  one_pager: "One-Pager",
  email_recap: "Email Recap",
  risk_register: "Risk Register",
  newsletter_brief: "Newsletter Brief",
  meeting_agenda: "Meeting Agenda",
  deck: "Deck",
  custom: "Custom",
};

const STATUS_COLORS: Record<string, string> = {
  briefing: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  awaiting_review: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  briefing: "Briefing",
  active: "Active",
  paused: "Paused",
  awaiting_review: "Awaiting Review",
  completed: "Completed",
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  leadership: "Leadership",
  support: "Support",
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Local UI state
  const [configOpen, setConfigOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────────────

  const {
    data: scenarios,
    isLoading: scenariosLoading,
    refetch: refetchScenarios,
  } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios"],
  });

  const { data: userConfig, isLoading: configLoading } = useQuery<UserConfig>({
    queryKey: ["/api/user-config"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  // ─── Mutations ─────────────────────────────────────────────────────────

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-config"] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<UserConfig>) => {
      const res = await apiRequest("PATCH", "/api/user-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-config"] });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      scenarioId: number;
      mode: "practice" | "assessment";
      userRole: string;
      userSeniority: string;
      currentChannel: string;
      config: {
        procurementStrictness: boolean;
        complianceSensitivity: boolean;
        tickingClockPressure: boolean;
      };
    }) => {
      const res = await apiRequest("POST", "/api/sessions", data);
      return res.json();
    },
    onSuccess: (session: Session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setLocation(`/session/${session.id}`);
    },
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
  });

  // ─── Auto-seed on first load ───────────────────────────────────────────

  useEffect(() => {
    if (
      !hasSeeded &&
      !scenariosLoading &&
      scenarios !== undefined &&
      scenarios.length === 0 &&
      !seedMutation.isPending
    ) {
      setHasSeeded(true);
      seedMutation.mutate();
    }
  }, [scenarios, scenariosLoading, hasSeeded, seedMutation]);

  // ─── Config update helpers ─────────────────────────────────────────────

  const updateRole = useCallback(
    (role: string) => {
      updateConfigMutation.mutate({ role });
    },
    [updateConfigMutation],
  );

  const updateSeniority = useCallback(
    (seniorityLevel: string) => {
      updateConfigMutation.mutate({ seniorityLevel });
    },
    [updateConfigMutation],
  );

  const updateMode = useCallback(
    (checked: boolean) => {
      updateConfigMutation.mutate({
        preferredMode: checked ? "assessment" : "practice",
      });
    },
    [updateConfigMutation],
  );

  const toggleChannel = useCallback(
    (channel: string) => {
      if (!userConfig) return;
      const current = userConfig.activeChannels;
      const next = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      updateConfigMutation.mutate({ activeChannels: next });
    },
    [userConfig, updateConfigMutation],
  );

  const toggleConstraint = useCallback(
    (key: "procurementStrictness" | "complianceSensitivity" | "tickingClockPressure") => {
      if (!userConfig) return;
      const current = userConfig.constraintToggles;
      updateConfigMutation.mutate({
        constraintToggles: { ...current, [key]: !current[key] },
      });
    },
    [userConfig, updateConfigMutation],
  );

  // ─── Session start handler ─────────────────────────────────────────────

  const startSession = useCallback(
    (scenario: Scenario, mode: "practice" | "assessment") => {
      if (!userConfig) return;
      createSessionMutation.mutate({
        scenarioId: scenario.id,
        mode,
        userRole: userConfig.role,
        userSeniority: userConfig.seniorityLevel,
        currentChannel: (scenario.channels[0] as string) || "email",
        config: userConfig.constraintToggles,
      });
    },
    [userConfig, createSessionMutation],
  );

  // ─── Loading state ─────────────────────────────────────────────────────

  if (scenariosLoading || configLoading || seedMutation.isPending) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {seedMutation.isPending ? "Initializing database..." : "Loading..."}
        </p>
      </div>
    );
  }

  const activeTemplateCount = templates?.filter((t) => t.isActive).length ?? 0;
  const totalTemplateCount = templates?.length ?? 0;
  const recentSessions = sessions
    ? [...sessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ).slice(0, 5)
    : [];
  const scenarioMap = new Map(
    (scenarios ?? []).map((s) => [s.id, s]),
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                What do you want to practice today?
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Work Skills OS — AI-driven practice and assessment for interpersonal skills
              </p>
            </div>
          </div>
        </header>

        {/* ── Status Bar ───────────────────────────────────────────────── */}
        {userConfig && (
          <Card>
            <CardContent className="py-3 px-6">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="secondary">{userConfig.role}</Badge>
                </div>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Seniority:</span>
                  <Badge variant="secondary">{userConfig.seniorityLevel}</Badge>
                </div>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant={userConfig.preferredMode === "assessment" ? "default" : "outline"}>
                    {userConfig.preferredMode === "assessment" ? "Assessment" : "Practice"}
                  </Badge>
                </div>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Channels:</span>
                  <span className="font-medium text-foreground">
                    {userConfig.activeChannels.length} active
                  </span>
                </div>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Templates:</span>
                  <span className="font-medium text-foreground">
                    {templatesLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin inline" />
                    ) : (
                      `${activeTemplateCount}/${totalTemplateCount} loaded`
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Configuration ────────────────────────────────────────────── */}
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Configuration</CardTitle>
                  </div>
                  {configOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription>
                  Set your role, mode, channels, and constraints before starting a session
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {userConfig && (
                <CardContent className="space-y-6">
                  {/* Role + Seniority */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Role</label>
                      <Select
                        value={userConfig.role}
                        onValueChange={updateRole}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Seniority Level</label>
                      <Select
                        value={userConfig.seniorityLevel}
                        onValueChange={updateSeniority}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select seniority" />
                        </SelectTrigger>
                        <SelectContent>
                          {SENIORITY_LEVELS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Mode</label>
                      <div className="flex items-center gap-3 h-9">
                        <span
                          className={`text-sm ${
                            userConfig.preferredMode === "practice"
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          Practice
                        </span>
                        <Switch
                          checked={userConfig.preferredMode === "assessment"}
                          onCheckedChange={updateMode}
                        />
                        <span
                          className={`text-sm ${
                            userConfig.preferredMode === "assessment"
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          Assessment
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Channels */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Channels to Simulate
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {CHANNELS.map((ch) => {
                        const Icon = ch.icon;
                        const active = userConfig.activeChannels.includes(ch.key);
                        return (
                          <label
                            key={ch.key}
                            className="flex items-center gap-2 cursor-pointer select-none"
                          >
                            <Checkbox
                              checked={active}
                              onCheckedChange={() => toggleChannel(ch.key)}
                            />
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{ch.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Constraints */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Constraints
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {CONSTRAINTS.map((c) => {
                        const Icon = c.icon;
                        const active = userConfig.constraintToggles[c.key];
                        return (
                          <Tooltip key={c.key}>
                            <TooltipTrigger asChild>
                              <div
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                                  active
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border bg-background"
                                }`}
                                onClick={() => toggleConstraint(c.key)}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon
                                    className={`h-4 w-4 ${
                                      active ? "text-primary" : "text-muted-foreground"
                                    }`}
                                  />
                                  <span className="text-sm font-medium">{c.label}</span>
                                </div>
                                <Switch
                                  checked={active}
                                  onCheckedChange={() => toggleConstraint(c.key)}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="max-w-[200px] text-xs">{c.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ── Use Case Tiles ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Use Cases</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(scenarios ?? [])
              .filter((s) => s.featured)
              .map((scenario) => (
                <Card key={scenario.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base leading-tight">
                          {scenario.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={DIFFICULTY_COLORS[scenario.difficulty]}
                          >
                            {scenario.difficulty}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {CATEGORY_LABELS[scenario.category] ?? scenario.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="text-xs mt-2 line-clamp-3">
                      {scenario.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 pb-3">
                    {/* Client info */}
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {scenario.clientProfile.name}
                      </span>{" "}
                      &mdash; {scenario.clientProfile.industry}
                    </div>

                    {/* Required Artifacts */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Required Artifacts
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {scenario.requiredArtifacts.map((a) => (
                          <Badge
                            key={a}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {ARTIFACT_LABELS[a] ?? a}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Competencies */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Competencies
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {scenario.competencies.slice(0, 5).map((c) => (
                          <Badge
                            key={c}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {c}
                          </Badge>
                        ))}
                        {scenario.competencies.length > 5 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            +{scenario.competencies.length - 5}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {scenario.estimatedSteps} steps
                      </span>
                      <span>
                        {scenario.roleRequired} ({scenario.seniorityLevel})
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="gap-2 pt-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      disabled={createSessionMutation.isPending}
                      onClick={() => startSession(scenario, "practice")}
                    >
                      {createSessionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Start Practice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={createSessionMutation.isPending}
                      onClick={() => startSession(scenario, "assessment")}
                    >
                      {createSessionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ClipboardCheck className="h-4 w-4" />
                      )}
                      Run Assessment
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>

          {/* Non-featured scenarios */}
          {(scenarios ?? []).filter((s) => !s.featured).length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">Other Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(scenarios ?? [])
                  .filter((s) => !s.featured)
                  .map((scenario) => (
                    <Card key={scenario.id} className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{scenario.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${DIFFICULTY_COLORS[scenario.difficulty]}`}
                          >
                            {scenario.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {scenario.estimatedSteps} steps
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startSession(scenario, userConfig?.preferredMode ?? "practice")}
                        disabled={createSessionMutation.isPending}
                      >
                        <Play className="h-3 w-3" />
                        Start
                      </Button>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Templates ────────────────────────────────────────────────── */}
        <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Templates</CardTitle>
                    <Badge variant="secondary" className="text-xs ml-1">
                      {activeTemplateCount} active
                    </Badge>
                  </div>
                  {templatesOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription>
                  Artifact templates used during practice and assessment sessions
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !templates || templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No templates loaded. Seed the database to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-1.5 rounded ${
                              template.isActive ? "bg-primary/10" : "bg-muted"
                            }`}
                          >
                            <FileText
                              className={`h-4 w-4 ${
                                template.isActive
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {template.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {template.type.replace(/_/g, " ")}
                              </Badge>
                              {template.roleMapping && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {template.roleMapping}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={(checked) =>
                            toggleTemplateMutation.mutate({
                              id: template.id,
                              isActive: checked,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ── Recent Sessions ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Recent Sessions</h2>
          </div>

          {sessionsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : recentSessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-full bg-muted mb-3">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a practice session from one of the use cases above
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => {
                const scenario = scenarioMap.get(session.scenarioId);
                return (
                  <Card
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setLocation(`/session/${session.id}`)}
                  >
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 rounded bg-muted">
                          {session.mode === "assessment" ? (
                            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Play className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {scenario?.title ?? `Session #${session.id}`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${
                                STATUS_COLORS[session.status] ?? ""
                              }`}
                            >
                              {STATUS_LABELS[session.status] ?? session.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {session.mode} | Step {session.currentStep}
                              {scenario ? ` / ${scenario.estimatedSteps}` : ""}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {session.userRole} ({session.userSeniority})
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {new Date(session.startedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-muted-foreground/60 py-4">
          Work Skills OS v1.0 &middot; AI-driven multi-agent practice &amp; assessment
        </footer>
      </div>
    </div>
  );
}
