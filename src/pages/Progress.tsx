import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Clock, Target, TrendingUp, Eye, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Progress() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["test-attempts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Filter out attempts that are "soft deleted" (marked as disqualified with reason 'user_deleted')
  /* 
  const visibleAttempts = attempts?.filter(
    (a) => !(a.status === "disqualified" && a.disqualification_reason === "user_deleted")
  ) || [];
  */
  const visibleAttempts = attempts || [];

  // Helper to recalculate score if it's 0 (Retroactive Fix)
  const getAttemptScore = (attempt: any) => {
    if (attempt.score > 0) return attempt.score;
    if (attempt.test_type !== 'aptitude' && attempt.test_type !== 'oa') return 0;
    if (!attempt.questions || !attempt.answers) return 0;

    // Calculate locally with robust matching
    let correct = 0;
    attempt.questions.forEach((q: any, i: number) => {
      const userAns = Array.isArray(attempt.answers) ? attempt.answers[i] : (attempt.answers as any)?.[i];
      if (!userAns || !q.correctAnswer) return;

      const userAnsUpper = String(userAns).toUpperCase();
      const rawCorrect = String(q.correctAnswer).trim();
      let correctLetter = "";

      // Strategy 1: Direct Letter match
      const letterMatch = rawCorrect.match(/^(?:Option\s+)?([A-D])(?:[.)]|$)/i);

      if (letterMatch) {
        correctLetter = letterMatch[1].toUpperCase();
      }
      // Strategy 2: Content Match
      else if (q.options) {
        const matchIndex = q.options.findIndex((opt: string) =>
          opt.trim().toLowerCase() === rawCorrect.toLowerCase() ||
          rawCorrect.toLowerCase().includes(opt.trim().toLowerCase())
        );
        if (matchIndex !== -1) {
          correctLetter = ["A", "B", "C", "D"][matchIndex];
        }
      }

      if (userAnsUpper === correctLetter) {
        correct++;
      }
    });
    return Math.round((correct / attempt.questions.length) * 100);
  };

  // Helper to format test type
  const formatTestType = (type: string) => {
    switch (type) {
      case 'oa': return 'Online Assessment';
      case 'tech1': return 'Technical Round 1';
      case 'tech2': return 'Technical Round 2';
      case 'behavioral': return 'Managerial Round';
      case 'hr': return 'HR Round';
      case 'aptitude': return 'Aptitude Test';
      case 'interview': return 'Mock Interview';
      default: return type.charAt(0).toUpperCase() + type.slice(1) + ' Test';
    }
  };

  const completedTests = visibleAttempts.filter((a) => a.status === "completed");
  const disqualifiedTests = visibleAttempts.filter(
    (a) => a.status === "disqualified" && a.disqualification_reason !== "user_deleted"
  );

  const averageScore = completedTests.length
    ? Math.round(completedTests.reduce((acc, t) => acc + getAttemptScore(t), 0) / completedTests.length)
    : 0;


  // Prepare Chart Data (Reverse to show chronological order)
  // Only show COMPLETED tests in the graph, hiding disqualified ones
  const chartData = completedTests
    .slice()
    .reverse()
    .map((attempt, index) => ({
      name: `Test ${index + 1}`,
      score: getAttemptScore(attempt),
      role: attempt.job_role,
      date: new Date(attempt.created_at).toLocaleDateString(),
    }));

  console.log("DEBUG: All Attempts:", attempts);
  console.log("DEBUG: Visible Attempts:", visibleAttempts);
  console.log("DEBUG: Chart Data:", chartData);

  const handleClearHistory = async () => {
    if (!user) return;

    // Optimistically update UI
    queryClient.setQueryData(["test-attempts", user.id], []);

    // Optimistically update UI
    queryClient.setQueryData(["test-attempts", user.id], []);

    // Soft Delete: Update all to disqualified with special reason
    const { error } = await supabase
      .from("test_attempts")
      .update({ status: 'disqualified', disqualification_reason: 'user_deleted' })
      .eq("user_id", user.id);

    if (error) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ["test-attempts", user.id] });
      toast({
        title: "Error",
        description: "Failed to clear history.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "History Cleared",
        description: "All your test records have been permanently deleted.",
      });
      // Invalidate to ensure sync
      queryClient.invalidateQueries({ queryKey: ["test-attempts", user.id] });
    }
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    if (!user) return;

    // Optimistically update UI
    queryClient.setQueryData(["test-attempts", user.id], (old: any[] | undefined) => {
      return old ? old.filter(attempt => attempt.id !== attemptId) : [];
    });

    const { error } = await supabase
      .from("test_attempts")
      .update({ status: 'disqualified', disqualification_reason: 'user_deleted' })
      .eq("id", attemptId);

    if (error) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ["test-attempts", user.id] });
      toast({
        title: "Error",
        description: "Failed to delete test record.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Record Deleted",
        description: "Test analysis removed.",
      });
      // Invalidate to ensure sync
      queryClient.invalidateQueries({ queryKey: ["test-attempts", user.id] });
    }
  };

  // Auto-scroll graph to end
  useEffect(() => {
    if (chartData.length > 0) {
      const scrollViewport = document.querySelector('#graph-scroll-area [data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollLeft = scrollViewport.scrollWidth;
      }
    }
  }, [chartData]); // Depend on chartData to scroll when loaded/updated

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">Progress Report</h1>
              <p className="text-sm text-muted-foreground">Track your preparation journey</p>
            </div>
          </div>

          {attempts && attempts.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const { error } = await supabase
                    .from("test_attempts")
                    .update({ status: 'completed', disqualification_reason: null })
                    .eq("user_id", user?.id)
                    .eq("disqualification_reason", "user_deleted");

                  if (!error) {
                    queryClient.invalidateQueries({ queryKey: ["test-attempts", user?.id] });
                    toast({ title: "History Restored", description: "Your previous test results have been recovered." });
                  } else {
                    toast({ title: "Error", description: "Failed to restore history.", variant: "destructive" });
                  }
                }}
              >
                Restore History
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Clear History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your entire test history and analysis data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, Clear History
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-card border-t-4 border-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{attempts?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Attempts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-t-4 border-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedTests.length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-t-4 border-indigo-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <div>
                    <p className="text-2xl font-bold">{averageScore}%</p>
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-t-4 border-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-600">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{disqualifiedTests.length}</p>
                  <p className="text-sm text-muted-foreground">Disqualified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Performance Chart - Scrollable Single View */}
        {
          completedTests.length > 0 && (
            <Card className="shadow-card mb-8 overflow-hidden">
              <CardHeader>
                <CardTitle className="font-display">Performance Trend</CardTitle>
                <CardDescription>Your score improvement over time (Scroll to see full history)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* ID added for auto-scroll logic */}
                <ScrollArea className="w-full whitespace-nowrap pb-4" id="graph-scroll-area">
                  <div className="h-[350px] p-4" style={{ minWidth: "100%" }}>
                    <div style={{ width: `${Math.max(100, chartData.length * 10)}%`, height: "100%" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                                    <p className="font-bold">{payload[0].payload.name}</p>
                                    <p className="font-medium text-xs text-muted-foreground">{payload[0].payload.role}</p>
                                    <p className="text-xs text-muted-foreground">{payload[0].payload.date}</p>
                                    <p className="text-primary font-bold mt-1 text-lg">
                                      {payload[0].value}%
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }}
                            activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--primary))" }}
                            className="drop-shadow-sm"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          )
        }

        {/* Test History */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Test History</CardTitle>
            <CardDescription>Your recent aptitude tests and interviews</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : attempts?.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">No tests taken yet</p>
                <Button onClick={() => navigate("/dashboard")}>Start Your First Test</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {attempts?.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{attempt.job_role}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {formatTestType(attempt.test_type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p
                            className={`font-semibold ${attempt.status === "completed"
                              ? "text-emerald-500"
                              : attempt.status === "disqualified"
                                ? "text-destructive"
                                : "text-amber-500"
                              }`}
                          >
                            {attempt.status === "completed"
                              ? `${getAttemptScore(attempt)}%`
                              : attempt.status.charAt(0).toUpperCase() + attempt.status.slice(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(attempt.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {/* Analysis Button */}
                          {attempt.questions && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <Eye className="h-4 w-4" /> View Analysis
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>Test Analysis: {attempt.job_role}</DialogTitle>
                                  <DialogDescription>Review your answers and solutions</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="h-[60vh] pr-4">
                                  <div className="space-y-6">
                                    {/* AI Feedback Summary */}
                                    {attempt.ai_feedback && (
                                      <div className="bg-muted p-4 rounded-lg">
                                        <h4 className="font-semibold mb-2">Overall Feedback</h4>
                                        <div className="prose prose-sm dark:prose-invert">
                                          {typeof attempt.ai_feedback === 'string'
                                            ? attempt.ai_feedback.split('\n').map((line: string, i: number) => <p key={i}>{line}</p>)
                                            : (attempt.ai_feedback as any).feedback?.split('\n').map((line: string, i: number) => <p key={i}>{line}</p>) || "No feedback available."
                                          }
                                        </div>
                                      </div>
                                    )}

                                    {Array.isArray(attempt.questions) && attempt.questions.map((q: any, i: number) => {
                                      const userAnswer = Array.isArray(attempt.answers) ? attempt.answers[i] : (attempt.answers as any)?.[i];

                                      // Logic to determine if correct (Shared with getAttemptScore)
                                      let isCorrect = false;
                                      if (userAnswer && q.correctAnswer) {
                                        const userAnsUpper = String(userAnswer).toUpperCase();
                                        const rawCorrect = String(q.correctAnswer).trim();
                                        let correctLetter = "";

                                        const letterMatch = rawCorrect.match(/^(?:Option\s+)?([A-D])(?:[.)]|$)/i);
                                        if (letterMatch) {
                                          correctLetter = letterMatch[1].toUpperCase();
                                        } else if (q.options) {
                                          const matchIndex = q.options.findIndex((opt: string) =>
                                            opt.trim().toLowerCase() === rawCorrect.toLowerCase() ||
                                            rawCorrect.toLowerCase().includes(opt.trim().toLowerCase())
                                          );
                                          if (matchIndex !== -1) {
                                            correctLetter = ["A", "B", "C", "D"][matchIndex];
                                          }
                                        }
                                        isCorrect = userAnsUpper === correctLetter;
                                      }

                                      const questionScores = (attempt.ai_feedback as any)?.questionScores;
                                      const qScore = questionScores?.[i];

                                      return (
                                        <div key={i} className="border p-4 rounded-lg">
                                          <div className="flex justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                              <h5 className="font-medium text-sm">Q{i + 1}: {q.question}</h5>
                                              {typeof qScore === 'number' && (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                  Score: {qScore}/10
                                                </Badge>
                                              )}
                                            </div>
                                            {attempt.test_type === 'aptitude' || attempt.test_type === 'oa' ? ( // Check OA/Aptitude
                                              isCorrect ?
                                                <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Correct</Badge> :
                                                <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Incorrect</Badge>
                                            ) : null}
                                          </div>

                                          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                                            <div className={attempt.test_type === 'aptitude' && !isCorrect ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                              <span className="block text-xs uppercase text-muted-foreground mb-1">Your Answer</span>
                                              {userAnswer || "Skipped"}
                                            </div>
                                            <div className="text-green-600 font-medium">
                                              <span className="block text-xs uppercase text-muted-foreground mb-1">Correct Answer</span>
                                              {attempt.test_type === 'aptitude' ? (q.correctAnswer || "See explanation") : "See explanation"}
                                            </div>
                                          </div>

                                          {q.explanation && (
                                            <div className="mt-3 bg-blue-50 dark:bg-blue-950/20 p-3 rounded text-sm text-blue-800 dark:text-blue-300">
                                              <span className="font-semibold">Explanation:</span> {q.explanation}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          )}

                          {/* Delete Single Button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this result?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the result for {attempt.job_role}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAttempt(attempt.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main >
    </div >
  );
}
