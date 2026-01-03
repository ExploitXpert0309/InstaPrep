import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, ChevronRight } from "lucide-react";

const educationLevels = [
  "High School",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD",
  "Diploma/Certification",
  "Self-Taught",
];

const fieldsOfStudy = [
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Software Engineering",
  "Electrical Engineering",
  "Business Administration",
  "Mathematics",
  "Statistics",
  "Economics",
  "Other",
];

export default function Onboarding() {
  const [education, setEducation] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleContinue = async () => {
    if (!education || !fieldOfStudy) {
      toast({
        title: "Please complete all fields",
        description: "Select your education level and field of study to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      education,
      field_of_study: fieldOfStudy,
      onboarding_complete: true,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated!",
        description: "You're all set. Let's start preparing!",
      });
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl gradient-primary shadow-glow mb-4">
            <GraduationCap className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">
            Welcome, {profile?.full_name || "there"}! 👋
          </h1>
          <p className="text-muted-foreground">
            Tell us about your educational background to personalize your experience
          </p>
        </div>

        <Card className="shadow-card animate-slide-up">
          <CardHeader>
            <CardTitle>Education Details</CardTitle>
            <CardDescription>
              This helps us tailor questions to your level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="education">Highest Qualification</Label>
              <Select value={education} onValueChange={setEducation}>
                <SelectTrigger id="education">
                  <SelectValue placeholder="Select your qualification" />
                </SelectTrigger>
                <SelectContent>
                  {educationLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field">Field of Study</Label>
              <Select value={fieldOfStudy} onValueChange={setFieldOfStudy}>
                <SelectTrigger id="field">
                  <SelectValue placeholder="Select your field" />
                </SelectTrigger>
                <SelectContent>
                  {fieldsOfStudy.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleContinue}
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue to Dashboard
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          You can update this information later in your profile settings
        </p>
      </div>
    </div>
  );
}
