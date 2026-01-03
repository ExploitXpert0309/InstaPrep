import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Loader2, ArrowLeft } from "lucide-react";

const jobRoles = [
  "Software Developer",
  "Data Analyst",
  "ML Engineer",
  "Product Manager",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Cloud Architect",
  "QA Engineer",
];

export default function RoleSelect() {
  const [selectedRole, setSelectedRole] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const testType = searchParams.get("type") || "aptitude";
  const isInterview = testType === "interview";

  const handleStart = () => {
    if (!selectedRole) return;
    setLoading(true);
    navigate(`/${testType}?role=${encodeURIComponent(selectedRole)}&count=${questionCount}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="shadow-card animate-slide-up">
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-2xl gradient-primary shadow-glow mb-4">
              <Briefcase className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-display">
              Select Your Target Role
            </CardTitle>
            <CardDescription>
              Choose the job role you're preparing for. We'll generate {isInterview ? "interview questions" : "aptitude questions"} tailored to this role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job role..." />
              </SelectTrigger>
              <SelectContent>
                {jobRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Number of Questions</label>
                <span className="text-sm text-muted-foreground">{questionCount}</span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                step="1"
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15</span>
                <span>60</span>
              </div>
            </div>

            <Button
              onClick={handleStart}
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!selectedRole || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Preparing...
                </>
              ) : (
                `Start ${isInterview ? "Interview" : "Aptitude Test"}`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
