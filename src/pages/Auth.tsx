import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Briefcase, Target, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

// Main Auth Component
export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sign Up Flow State
  const [signUpStep, setSignUpStep] = useState(0); // 0: Form, 1: OTP, 2: Privacy
  const [timer, setTimer] = useState(60);
  const [activeTab, setActiveTab] = useState("signin");

  // OTP State (Shared for Signup & Recovery)
  const [otpCode, setOtpCode] = useState("");

  // Forgot Password State
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0: Normal Login, 1: Email Input, 2: OTP Input, 3: New Password Input
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  /* Fix: Destructure signUp from useAuth at the top level */
  /* Fix: Destructure signUp from useAuth at the top level */
  const { signIn, signInWithGoogle, verifyOtp, signUp, signInWithOtp, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Timer Effect


  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (signUpStep === 1) {
      if (timer > 0) {
        interval = setInterval(() => {
          setTimer((prev) => prev - 1);
        }, 1000);
      } else {
        // Timer expired -> Redirect to Sign In without details
        resetAuth();
        toast({ title: "Time Expired", description: "Session timed out. Redirecting to Sign In.", variant: "destructive" });
      }
    }
    return () => clearInterval(interval);
  }, [signUpStep, timer]);

  const resetAuth = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setOtpCode("");
    setSignUpStep(0);
    setForgotPasswordStep(0);
    setConfirmPassword("");
    setRecoveryEmail("");
    setErrors({});
    setActiveTab("signin");
  };

  // ... (Existing handlers) ...

  const handleSignUpInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setLoading(true);
    try {
      // Use standard signUp to create the user immediately with password
      const { error } = await signUp(email, password, fullName);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setSignUpStep(1); // Move to OTP
        setOtpCode("");
        setTimer(60); // Reset timer
        toast({ title: "Verification Code Sent", description: "Please check your email for the confirmation code." });
      }
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred. Please try again.";
      toast({ title: "Unexpected Error", description: msg, variant: "destructive" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      // Calling signUp again for an unverified user triggers a resend
      const { error } = await signUp(email, password, fullName);

      if (error) {
        if (error.message.includes("registered")) {
          toast({ title: "Already Registered", description: "This email is already registered. Please sign in.", variant: "default" });
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      } else {
        setTimer(60);
        toast({ title: "Code Resent", description: "Check your email." });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to resend code.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Handlers
  const handleForgotPasswordInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setErrors({ email: "Please enter a valid email" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      // Use signInWithOtp (shouldCreateUser: false) to send a 6-digit code for existing users
      // This uses the "Magic Link" template which is often easier to configure for codes
      const { error } = await signInWithOtp(recoveryEmail, false);

      if (error) {
        let msg = error.message;
        if (msg.includes("Signups not allowed for otp")) {
          msg = "Account not found. Please Sign Up first.";
        }
        toast({ title: "Error", description: msg, variant: "destructive" });
      } else {
        setForgotPasswordStep(2); // Move to OTP
        setOtpCode("");
        toast({ title: "Code Sent", description: "Check your email for the recovery code." });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to send recovery code.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      toast({ title: "Invalid", description: "Code must be 6 digits.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Verify as 'email' type (standard OTP login)
      const { error } = await verifyOtp(recoveryEmail, otpCode, 'email');

      if (error) {
        toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
      } else {
        setForgotPasswordStep(3); // Move to New Password
        toast({ title: "Verified", description: "Please set your new password." });
      }
    } catch (err) {
      toast({ title: "Error", description: "Verification failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrors({ password: "Password must be at least 6 characters" });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast({ title: "Update Failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Password updated successfully! Please sign in with your new password." });
        resetAuth(); // Back to login
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };



  const validateForm = (isSignUp: boolean) => {
    const newErrors: Record<string, string> = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (isSignUp) {
      try {
        nameSchema.parse(fullName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.fullName = e.errors[0].message;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message === "Invalid login credentials"
            ? "Invalid email or password. Please try again."
            : error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        navigate("/");
      }
    } catch (err) {
      toast({ title: "Error", description: "An unexpected error occurred during sign in.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      toast({ title: "Invalid", description: "Code must be at least 6 digits.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP (Confirm Signup)
      const { error: verifyError } = await verifyOtp(email, otpCode, 'signup');

      if (verifyError) {
        // Requirement: Redirect to signin on wrong OTP
        resetAuth();
        toast({
          title: "Verification Failed",
          description: "Incorrect OTP. Redirecting to Sign In...",
          variant: "destructive",
        });
        return;
      }

      // 2. User confirmed & Logged in. Profile/Password already set.
      setSignUpStep(2); // Move to Privacy Policy
    } catch (err) {
      toast({ title: "Error", description: "Verification failed unexpectedly.", variant: "destructive" });
      resetAuth();
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyAccept = () => {
    navigate("/"); // Done
  };



  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl gradient-primary shadow-glow">
              <Target className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold text-primary-foreground">
              InstaPrep
            </h1>
          </div>
          <p className="text-primary-foreground/70">
            AI-Powered Job Interview Preparation
          </p>
        </div>

        <Card className="shadow-card border-0 animate-slide-up">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display">Get Started</CardTitle>
            <CardDescription>
              Sign in or create an account to begin your preparation journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                {forgotPasswordStep === 0 ? (
                  /* Standard Sign In */
                  <form onSubmit={handleSignIn} className="space-y-4 animate-in fade-in slide-in-from-left-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Password</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryEmail(email);
                            setForgotPasswordStep(1);
                          }}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      variant="gradient"
                      size="lg"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
                    </Button>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => signInWithGoogle()}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                      </svg>
                      Google
                    </Button>
                  </form>
                ) : (
                  /* Forgot Password Flow */
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                    {/* Step 1: Email Input */}
                    {forgotPasswordStep === 1 && (
                      <form onSubmit={handleForgotPasswordInitiate} className="space-y-4">
                        <div className="text-center space-y-2">
                          <h3 className="font-semibold text-lg">Reset Password</h3>
                          <p className="text-sm text-muted-foreground">Enter your email to receive a recovery code.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="recovery-email">Email</Label>
                          <Input
                            id="recovery-email"
                            type="email"
                            placeholder="you@example.com"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            className={errors.email ? "border-destructive" : ""}
                          />
                          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="animate-spin" /> : "Send Recovery Code"}
                        </Button>
                        <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotPasswordStep(0)}>
                          Back to Sign In
                        </Button>
                      </form>
                    )}

                    {/* Step 2: OTP Input */}
                    {forgotPasswordStep === 2 && (
                      <form onSubmit={handleForgotPasswordVerify} className="space-y-4 text-center">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg">Enter Code</h3>
                          <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {recoveryEmail}</p>
                        </div>
                        <Input
                          id="recovery-otp"
                          type="text"
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="text-center tracking-[1em] text-xl font-mono h-14"
                          maxLength={8}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="animate-spin" /> : "Verify Code"}
                        </Button>
                        <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotPasswordStep(1)}>
                          Change Email
                        </Button>
                      </form>
                    )}

                    {/* Step 3: New Password */}
                    {forgotPasswordStep === 3 && (
                      <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="text-center space-y-2">
                          <h3 className="font-semibold text-lg">Set New Password</h3>
                          <p className="text-sm text-muted-foreground">Create a new secure password.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Min 6 characters"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Min 6 characters"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={errors.confirmPassword ? "border-destructive" : ""}
                          />
                          {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="animate-spin" /> : "Update Password"}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="signup">

                {signUpStep === 0 && (
                  <form onSubmit={handleSignUpInitiate} className="space-y-4 animate-in fade-in slide-in-from-right-8">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={errors.fullName ? "border-destructive" : ""}
                      />
                      {errors.fullName && (
                        <p className="text-sm text-destructive">{errors.fullName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Set Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      variant="gradient"
                      size="lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin mr-2" /> Sending OTP...
                        </>
                      ) : (
                        "Verify Email"
                      )}
                    </Button>
                  </form>
                )}

                {signUpStep === 1 && (
                  <form onSubmit={handleSignUpVerify} className="space-y-6 animate-in fade-in slide-in-from-right-8 text-center">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">Check your Inbox</h3>
                      <p className="text-sm text-muted-foreground">We sent a verification code to <span className="font-medium text-foreground">{email}</span></p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-otp" className="sr-only">OTP Code</Label>
                      <Input
                        id="signup-otp"
                        type="text"
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="text-center tracking-[1em] text-xl font-mono h-14"
                        maxLength={8}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      variant="gradient"
                      size="lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin mr-2" /> Verifying...
                        </>
                      ) : (
                        "Verify & Create Account"
                      )}
                    </Button>

                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Time remaining: <span className={timer > 0 ? "text-primary font-bold" : "text-muted-foreground"}>00:{timer < 10 ? `0${timer}` : timer}</span>
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        disabled={timer > 0 || loading}
                        onClick={handleResendOtp}
                        className="text-xs"
                      >
                        Resend Code
                      </Button>
                    </div>

                    <Button type="button" variant="ghost" size="sm" onClick={() => setSignUpStep(0)}>
                      Back to details
                    </Button>
                  </form>
                )}

                {signUpStep === 2 && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 text-center py-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-display font-bold text-xl">Account Verified!</h3>
                      <p className="text-muted-foreground text-sm">Before you begin, please review our policies.</p>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg text-left text-xs text-muted-foreground italic h-32 overflow-y-auto border">
                      <p><strong>Privacy Policy & Terms</strong></p>
                      <p className="mt-2">1. <strong>Data Collection:</strong> We collect your name, email, and test performance data to provide personalized interview preparation.</p>
                      <p className="mt-2">2. <strong>AI Usage:</strong> Your responses during interviews are processed by AI models to generate feedback. We do not use your personal data to train public models.</p>
                      <p className="mt-2">3. <strong>Security:</strong> All data is encrypted at rest and in transit.</p>
                      <p className="mt-2">By clicking "Accept", you acknowledge that you have read and understood these terms.</p>
                    </div>

                    <Button
                      onClick={handlePrivacyAccept}
                      className="w-full"
                      variant="default"
                      size="lg"
                    >
                      Accept & Go to Dashboard
                    </Button>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center animate-fade-in">
          <div className="p-4 rounded-xl glass-card">
            <GraduationCap className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-primary-foreground/80">AI-Powered Learning</p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <Briefcase className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-primary-foreground/80">Real Interview Prep</p>
          </div>
          <div className="p-4 rounded-xl glass-card">
            <Target className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-primary-foreground/80">Track Progress</p>
          </div>
        </div>
      </div>
    </div>
  );
}
