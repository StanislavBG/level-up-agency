import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  FileText,
  ArrowLeft,
  ClipboardCheck,
  User,
  Loader2,
  TrendingUp,
  TrendingDown,
  Shield,
} from "lucide-react";

interface AssessmentScores {
  persuasiveness: number;
  objectionHandling: number;
  interpersonalVibe: number;
  writtenCommunication: number;
  artifactQuality: number;
  sequencingStrategy: number;
  decisionQuality: number;
}

interface FrictionPoint {
  area: string;
  description: string;
  severity: "low" | "medium" | "high";
  channel: string;
}

interface Assessment {
  id: number;
  sessionId: number;
  status: string;
  overallScore: number;
  recommendation: string;
  summary: string;
  scores: AssessmentScores;
  frictionPoints: FrictionPoint[];
  strengths: string[];
  areasForImprovement: string[];
  hitlRequired: boolean;
  hitlVerdict: string | null;
  hitlNotes: string | null;
}

interface Session {
  id: number;
  scenarioTitle: string;
  mode: string;
  createdAt: string;
}

const SCORE_LABELS: { key: keyof AssessmentScores; label: string; icon: typeof BarChart3 }[] = [
  { key: "persuasiveness", label: "Persuasiveness", icon: Target },
  { key: "objectionHandling", label: "Objection Handling", icon: Shield },
  { key: "interpersonalVibe", label: "Interpersonal Vibe", icon: User },
  { key: "writtenCommunication", label: "Written Communication", icon: FileText },
  { key: "artifactQuality", label: "Artifact Quality", icon: ClipboardCheck },
  { key: "sequencingStrategy", label: "Sequencing & Strategy", icon: BarChart3 },
  { key: "decisionQuality", label: "Decision Quality", icon: Target },
];

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-500/10";
  if (score >= 50) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function getRecommendationStyle(recommendation: string): {
  className: string;
  icon: typeof CheckCircle2;
} {
  const lower = recommendation.toLowerCase();
  if (lower === "pass") {
    return { className: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle2 };
  }
  if (lower === "fail") {
    return { className: "bg-red-100 text-red-800 border-red-300", icon: XCircle };
  }
  return { className: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: AlertTriangle };
}

function getSeverityStyle(severity: string): string {
  switch (severity) {
    case "low":
      return "bg-green-100 text-green-800 border-green-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "high":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function getOverallScoreRingColor(score: number): string {
  if (score >= 70) return "stroke-green-500";
  if (score >= 50) return "stroke-yellow-500";
  return "stroke-red-500";
}

function getOverallScoreBgRing(score: number): string {
  if (score >= 70) return "stroke-green-100";
  if (score >= 50) return "stroke-yellow-100";
  return "stroke-red-100";
}

function CircularScore({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          className={getOverallScoreBgRing(score)}
          strokeWidth="12"
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          className={getOverallScoreRingColor(score)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-sm text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}

export default function Assessment() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [hitlVerdict, setHitlVerdict] = useState<string>("");
  const [hitlNotes, setHitlNotes] = useState<string>("");

  const {
    data: assessment,
    isLoading: assessmentLoading,
    error: assessmentError,
  } = useQuery<Assessment>({
    queryKey: [`/api/sessions/${sessionId}/assessment`],
    enabled: sessionId > 0,
  });

  const {
    data: session,
    isLoading: sessionLoading,
  } = useQuery<Session>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: sessionId > 0,
  });

  const hitlMutation = useMutation({
    mutationFn: async (data: { verdict: string; notes: string }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/assessments/${assessment?.id}/hitl`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/sessions/${sessionId}/assessment`],
      });
    },
  });

  const isLoading = assessmentLoading || sessionLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading assessment results...</p>
        </div>
      </div>
    );
  }

  if (assessmentError || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Assessment Not Found</CardTitle>
            <CardDescription>
              Unable to load the assessment for this session. The session may not
              have been completed or the assessment is still being generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recStyle = getRecommendationStyle(assessment.recommendation);
  const RecIcon = recStyle.icon;

  const alreadyReviewed = !!assessment.hitlVerdict;

  const handleHitlSubmit = () => {
    if (!hitlVerdict) return;
    hitlMutation.mutate({ verdict: hitlVerdict, notes: hitlNotes });
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <h1 className="text-3xl font-bold tracking-tight">Assessment Report</h1>
                {session && (
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {session.scenarioTitle}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>
                      {new Date(session.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <Badge variant="secondary" className="capitalize">
                      {session.mode}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Overall Score Card */}
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <CircularScore score={assessment.overallScore} />
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Overall Score</h2>
                    <div className="inline-flex items-center gap-2">
                      <Badge
                        className={`text-sm px-3 py-1 border ${recStyle.className}`}
                      >
                        <RecIcon className="h-4 w-4 mr-1.5" />
                        {assessment.recommendation}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed max-w-xl">
                    {assessment.summary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Score Breakdown</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {SCORE_LABELS.map(({ key, label, icon: Icon }) => {
                const score = assessment.scores[key];
                return (
                  <Card key={key} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-md ${getScoreBgColor(score)}`}
                          >
                            <Icon className={`h-4 w-4 ${getScoreColor(score)}`} />
                          </div>
                          <span className="text-sm font-medium leading-tight">
                            {label}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                              {score}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{score}/100</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${getScoreBarColor(score)}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Friction Points */}
          {assessment.frictionPoints && assessment.frictionPoints.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Friction Points</h2>
                <Badge variant="secondary" className="ml-1">
                  {assessment.frictionPoints.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {assessment.frictionPoints.map((fp, index) => (
                  <Card key={index}>
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-sm">{fp.area}</h3>
                            <Badge
                              className={`text-xs border capitalize ${getSeverityStyle(fp.severity)}`}
                            >
                              {fp.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {fp.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{fp.channel}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Strengths and Areas for Improvement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            {assessment.strengths && assessment.strengths.length > 0 && (
              <Card className="border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg text-green-700">Strengths</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {assessment.strengths.map((strength, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-foreground leading-relaxed">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Areas for Improvement */}
            {assessment.areasForImprovement && assessment.areasForImprovement.length > 0 && (
              <Card className="border-yellow-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-yellow-600" />
                    <CardTitle className="text-lg text-yellow-700">
                      Areas for Improvement
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {assessment.areasForImprovement.map((area, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <span className="text-foreground leading-relaxed">{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* HITL Review Section */}
          {assessment.hitlRequired && (
            <Card className="border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <Shield className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-blue-800">
                      Human Review Required
                    </p>
                    <p className="text-xs text-blue-600">
                      This assessment is pending human supervisor review
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {alreadyReviewed ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Verdict:
                      </span>
                      <Badge
                        className={`border ${getRecommendationStyle(assessment.hitlVerdict!).className}`}
                      >
                        {assessment.hitlVerdict}
                      </Badge>
                    </div>
                    {assessment.hitlNotes && (
                      <div className="space-y-1.5">
                        <span className="text-sm font-medium text-muted-foreground">
                          Reviewer Notes:
                        </span>
                        <div className="p-3 rounded-md bg-muted text-sm leading-relaxed">
                          {assessment.hitlNotes}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Verdict</label>
                      <Select
                        value={hitlVerdict}
                        onValueChange={setHitlVerdict}
                      >
                        <SelectTrigger className="w-full sm:w-[240px]">
                          <SelectValue placeholder="Select verdict..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pass">Pass</SelectItem>
                          <SelectItem value="Fail">Fail</SelectItem>
                          <SelectItem value="Needs Improvement">
                            Needs Improvement
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        value={hitlNotes}
                        onChange={(e) => setHitlNotes(e.target.value)}
                        placeholder="Add review notes..."
                        rows={4}
                      />
                    </div>
                    <Button
                      onClick={handleHitlSubmit}
                      disabled={!hitlVerdict || hitlMutation.isPending}
                    >
                      {hitlMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="h-4 w-4 mr-2" />
                          Submit Review
                        </>
                      )}
                    </Button>
                    {hitlMutation.isError && (
                      <p className="text-sm text-destructive">
                        Failed to submit review. Please try again.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 pb-8">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/session/${sessionId}`)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Review Transcript
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
