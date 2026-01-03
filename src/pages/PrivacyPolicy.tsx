import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Shield, Camera, Mic, Monitor, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function PrivacyPolicy() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAccept = async () => {
    if (!accepted) {
      toast({
        title: "Please accept the policy",
        description: "You must agree to the privacy policy to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      privacy_accepted: true,
      privacy_accepted_at: new Date().toISOString(),
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save your preference. Please try again.",
        variant: "destructive",
      });
    } else {
      navigate("/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl gradient-primary shadow-glow mb-4">
            <Shield className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            Privacy Policy & Guidelines
          </h1>
          <p className="text-muted-foreground">
            Please review and accept our assessment policies before continuing
          </p>
        </div>

        <div className="space-y-6 animate-slide-up">
          {/* Aptitude Test Rules */}
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                Aptitude Test Guidelines
              </CardTitle>
              <CardDescription>
                Rules and requirements during aptitude assessments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Camera className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Camera Access Required</p>
                  <p className="text-sm text-muted-foreground">
                    Your camera must be enabled throughout the test for monitoring purposes.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Mic className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Microphone Access Required</p>
                  <p className="text-sm text-muted-foreground">
                    Audio monitoring helps ensure test integrity.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Tab Switching Warning</p>
                  <p className="text-sm text-muted-foreground">
                    Opening any other browser tab will <strong>immediately end your exam</strong> and 
                    mark your status as <strong>DISQUALIFIED</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interview Rules */}
          <Card className="shadow-card border-l-4 border-l-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Mic className="h-5 w-5 text-accent" />
                </div>
                Interview Guidelines
              </CardTitle>
              <CardDescription>
                Rules and requirements during mock interviews
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Camera className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Camera & Microphone Required</p>
                  <p className="text-sm text-muted-foreground">
                    Both must remain active for voice-based Q&A.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Monitor className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Screen Sharing Mandatory</p>
                  <p className="text-sm text-muted-foreground">
                    You must share your screen during the interview session.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Disqualification Triggers</p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Background noise detection</li>
                    <li>• Tab switching during interview</li>
                    <li>• Screen share interruption</li>
                  </ul>
                  <p className="text-sm text-destructive mt-2">
                    Any violation will result in immediate disqualification.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggestion Box */}
          <Card className="shadow-card bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-primary">Pro Tip</p>
                  <p className="text-sm text-muted-foreground">
                    Do not open other tabs while giving the exam. Stay focused and complete each 
                    assessment in one sitting for the best experience.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agreement Section */}
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="accept"
                  checked={accepted}
                  onCheckedChange={(checked) => setAccepted(checked === true)}
                  className="mt-1"
                />
                <label htmlFor="accept" className="text-sm cursor-pointer">
                  I have read and understood the privacy policy and assessment guidelines. I agree 
                  to allow camera, microphone, and screen sharing access during assessments. I 
                  understand that violations will result in disqualification.
                </label>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleAccept}
            variant="gradient"
            size="xl"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Saving...
              </>
            ) : (
              "I Agree & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
