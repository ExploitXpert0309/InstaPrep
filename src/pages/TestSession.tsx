import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowRight, CheckCircle2, Mic, Play, Maximize, Minimize, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateQuestions, evaluateAnswers, GeminiQuestion, RoundType, runCodeWithAI, verifyFaceMatch } from "@/lib/gemini";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Interface for Web Speech API
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export default function TestSession() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const role = searchParams.get("role");
    const roundType = (searchParams.get("type") || "oa") as RoundType;
    const isOA = roundType === "oa"; // Online Assessment Check

    // Read difficulty level (default to Medium)
    const level = searchParams.get("level") || "Medium";

    // Count is passed for OA, but we might want to ignore it for interviews where it is calculated
    const countParam = searchParams.get("count");
    const paramValue = countParam ? parseInt(countParam) : 20;

    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient(); // Add QueryClient

    const [questions, setQuestions] = useState<GeminiQuestion[]>([]);
    const [answers, setAnswers] = useState<string[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // Startup & Phase State
    const [isGenerating, setIsGenerating] = useState(true); // Background generation status
    const [sessionPhase, setSessionPhase] = useState<'setup-camera' | 'setup-rules' | 'active'>('setup-camera');
    const [userSnapshot, setUserSnapshot] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    // Aptitude/OA specific state
    const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]));
    const [timeLimit, setTimeLimit] = useState<number>(0); // in minutes
    const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds

    // Coding Challenge State
    const [code, setCode] = useState("");
    const [consoleOutput, setConsoleOutput] = useState("");
    const [isRunningCode, setIsRunningCode] = useState(false);
    const [language, setLanguage] = useState("javascript");
    const [submittedCodingIndices, setSubmittedCodingIndices] = useState<Set<number>>(new Set());

    // Templates for each language
    const LANGUAGE_TEMPLATES: Record<string, string> = {
        javascript: `function solve() {\n  // Your code here\n  console.log("Hello JavaScript");\n}`,
        python: `def solve():\n    # Your code here\n    print("Hello Python")`,
        java: `public class Main {\n    public static void main(String[] args) {\n        // Your code here\n        System.out.println("Hello Java");\n    }\n}`,
        cpp: `#include <iostream>\n\nint main() {\n    // Your code here\n    std::cout << "Hello C++" << std::endl;\n    return 0;\n}`,
        c: `#include <stdio.h>\n\nint main() {\n    // Your code here\n    printf("Hello C\\n");\n    return 0;\n}`,
        html: `<!DOCTYPE html>\n<html>\n<head>\n  <title>Page</title>\n</head>\n<body>\n  <h1>Hello HTML</h1>\n</body>\n</html>`,
        css: `body {\n  font-family: sans-serif;\n  background-color: #f0f0f0;\n}\n\nh1 {\n  color: #333;\n}`,
        sql: `SELECT * FROM users WHERE id = 1;`
    };

    const handleLanguageChange = (val: string) => {
        setLanguage(val);
        const newCode = LANGUAGE_TEMPLATES[val] || "";
        setCode(newCode);
        // We verify handleAnswerChange is defined later in the component, which is fine for execution time
        if (typeof handleAnswerChange === 'function') {
            handleAnswerChange(newCode);
        }
    };

    // Interview specific state
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState("");
    const recognitionRef = useRef<any>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [malpracticeWarnings, setMalpracticeWarnings] = useState(0);
    const isVerifyingRef = useRef(false);

    const [warnings, setWarnings] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const answersRef = useRef<string[]>([]); // Ref to avoid stale closures in intervals

    // Full Screen State
    const [isFullScreen, setIsFullScreen] = useState(false);

    const stopMediaTracks = () => {
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (recognitionRef.current) recognitionRef.current.stop();
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        // Stop Audio Context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // Stop Screen Share
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.error("Full screen denied:", e);
            });
            setIsFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullScreen(false);
            }
        }
    };

    useEffect(() => {
        const handleFSChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFSChange);
        return () => document.removeEventListener("fullscreenchange", handleFSChange);
    }, []);

    // Sync answers ref for malpractice handler
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    // TTS: Speak Question Logic
    const speakText = (text: string) => {
        if (!window.speechSynthesis) return;

        // Cancel ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Select Voice: Prefer "Google US English" or any "en-US"
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google US English")) ||
            voices.find(v => v.lang === "en-US") ||
            voices[0];

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };

    // Auto-Speak on Question Change (Interview Modes Only)
    useEffect(() => {
        if (!isOA && questions[currentQuestionIndex] && sessionPhase === 'active') {
            // Small delay to allow UI to settle
            const timer = setTimeout(() => {
                const qText = questions[currentQuestionIndex].question;
                speakText(qText);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentQuestionIndex, questions, isOA, sessionPhase]);

    // Ensure voices are loaded (Chrome quirk)
    useEffect(() => {
        window.speechSynthesis.getVoices();
    }, []);

    // Helper: Handle Malpractice
    const handleMalpractice = (reason: string) => {
        if (submitting) return;

        setWarnings(prev => {
            const newCount = prev + 1;
            // console.log(`Malpractice Detected (${newCount}/10): ${reason}`); 

            if (newCount >= 10) {
                toast({
                    title: "Disqualified",
                    description: `Maximum warnings exceeded (${reason}). Ending test...`,
                    variant: "destructive",
                });
                submitTest(answersRef.current, true); // True = Disqualified
                return newCount;
            }

            // Debounce toast visually if needed, but for now logic holds
            toast({
                title: `Warning ${newCount}/10`,
                description: `${reason}. Please maintain test integrity.`,
                variant: "destructive",
            });

            return newCount;
        });
    };

    // Attach Video Stream on Render (Universal for all phases that allow video)
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, sessionPhase, roundType]);

    // 1. Initialize: Fetch Questions & Request Permissions (UNIVERSAL)
    useEffect(() => {
        if (!role) {
            navigate("/dashboard");
            return;
        }

        const initSession = async () => {
            // A. Start Camera Immediately
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                console.log("Permissions granted");
                setStream(mediaStream);
                // Video attach handled by separate effect

                // Initialize Audio Analysis for Noise Detection
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(mediaStream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);

                audioContextRef.current = audioContext;
                sourceRef.current = source;
                analyserRef.current = analyser;

                // Start noise monitoring loop
                // checkAudioLevels(); // Disabled as per user request

            } catch (err) {
                console.error("Permission denied:", err);
                toast({
                    title: "Setup Failed",
                    description: "Camera and Microphone are required for proctored rounds.",
                    variant: "destructive",
                });
            }

            // B. Fetch Questions in Background
            try {
                // Determine prompt type based on URL params is handled inside generateQuestions
                // We're just firing the request
                fetchQuestions();
            } catch (e) {
                console.error("Initiation error", e);
            }
        };

        initSession();
        // Removed stale cleanup here
    }, [role, roundType]);

    // NEW: Dedicated Stream Cleanup Effect (Fixes stale closure bug)
    useEffect(() => {
        return () => {
            if (stream) {
                console.log("Stopping stream tracks on unmount/change");
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const captureSnapshot = () => {
        if (videoRef.current) {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg");
            setUserSnapshot(dataUrl);
            setSessionPhase('setup-rules'); // Move to next phase
        }
    };

    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

    const startScreenShare = async (): Promise<boolean> => {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setScreenStream(displayStream);

            // Handle user stopping share via browser UI
            displayStream.getVideoTracks()[0].onended = () => {
                setScreenStream(null);
                toast({ title: "Screen Share Ended", description: "You stopped sharing your screen." });
            };
            return true;
        } catch (err) {
            console.error("Screen share denied:", err);
            toast({ title: "Screen Share Failed", description: "Screen sharing is required to start the interview.", variant: "destructive" });
            return false;
        }
    };

    const startTest = async () => {
        if (isGenerating) {
            toast({ title: "Please Wait", description: "Still generating your unique test set...", variant: "default" });
            return;
        }

        // 0. Enforce Screen Share for Interviews (Non-OA)
        if (!isOA && !screenStream) {
            const shared = await startScreenShare();
            if (!shared) return; // Stop if user cancelled or failed
        }

        // 1. Enter Full Screen
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setIsFullScreen(true);
            }
        } catch (err) {
            console.error("Full screen failed:", err);
            toast({ title: "Full Screen Required", description: "Please enable full screen to begin.", variant: "destructive" });
            // Ideally block start, but we warn
        }

        // Final transition
        setSessionPhase('active');
        // Start Listening only when Active
        if (!isOA && stream) {
            initializeSpeech();
        }
    };


    // 2. Timer Logic (Universal) - Robust Implementation
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timeLeft > 0 && !submitting && sessionPhase === 'active') {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        submitTest(answersRef.current); // Use ref to avoid stale closure
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [submitting, sessionPhase, timeLeft > 0]); // Minimal dependencies for stability
    const checkAudioLevels = () => {
        if (!analyserRef.current || submitting) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Threshold for "Noise" (Adjust based on testing, 30-50 is usually decent for silence vs speech)
        // We only warn if it's REALLY loud or sustained, but for simple logic:
        // We need a debouncer to avoid spamming.
        // For now, let's just log or set a flag. Implementing strict noise warning in loop is risky without debounce.
        // Let's implement a simple check in a separate interval instead of the animation frame loop to avoid spam.
    };

    // 4. Malpractice Check Interval (Noise & Focus)
    useEffect(() => {
        if (stream && !submitting && analyserRef.current) {
            const interval = setInterval(() => {
                // Check Audio
                const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
                analyserRef.current!.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;

                // Logic: If average volume > 50 (arbitrary localized threshold), warn.
                // This assumes a quiet room is < 10-20.
                /* Disabled background noise detection
                if (average > 40) { // Tunable threshold
                    handleMalpractice("Significant background noise detected");
                }
                */

                // Check for Malpractice (Camera brightness etc - placeholder)
                checkForMalpractice();

            }, 4000); // Check every 4 seconds to allow for "chances"
            return () => clearInterval(interval);
        }
    }, [stream, submitting]);

    // 5. Anti-Cheat: Tab Switch & Full Screen (Universal)
    useEffect(() => {
        if (!submitting && sessionPhase === 'active') {
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    handleMalpractice("Tab switch / Window focus lost");
                }
            };

            const handleFullScreenChange = () => {
                if (!document.fullscreenElement) {
                    setIsFullScreen(false);
                    handleMalpractice("Exited Full Screen");
                } else {
                    setIsFullScreen(true);
                }
            };

            document.addEventListener("visibilitychange", handleVisibilityChange);
            document.addEventListener("fullscreenchange", handleFullScreenChange);

            return () => {
                document.removeEventListener("visibilitychange", handleVisibilityChange);
                document.removeEventListener("fullscreenchange", handleFullScreenChange);
            };
        }
    }, [submitting, sessionPhase, answers]);


    const checkForMalpractice = async () => {
        if (!userSnapshot || isVerifyingRef.current || !videoRef.current || !stream) return;

        isVerifyingRef.current = true;
        try {
            // console.log("Proctoring: Verifying face identity...");
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
            const currentFrame = canvas.toDataURL("image/jpeg");

            // Verify with Gemini Vision
            const result = await verifyFaceMatch(userSnapshot, currentFrame);
            // console.log("Proctoring Result:", result);

            if (!result.match) {
                console.warn("Proctoring Mismatch:", result);
                // If confidence is 0, it might be an error or no face, we can be lenient or strict.
                // Prompt says "If Image B is black, blurry, or has NO face, return match: false."
                // "mismatched with the live recording" implies identity check.
                // We'll warn.
                handleMalpractice("Face Verification Failed: " + (result.error || "Identity Mismatch"));
            }
        } catch (e) {
            console.error("Proctoring Check Failed", e);
        } finally {
            isVerifyingRef.current = false;
        }
    };

    const fetchQuestions = async () => {
        try {
            const data = await generateQuestions(role!, roundType, paramValue, level);
            setQuestions(data.questions);
            setAnswers(new Array(data.questions.length).fill(""));

            // Set time limit
            if (data.timeLimit) {
                setTimeLimit(data.timeLimit);
                setTimeLeft(data.timeLimit * 60);
            } else {
                // Fallback if API doesn't return time
                const defaultTime = Math.max(20, paramValue);
                setTimeLimit(defaultTime);
                setTimeLeft(defaultTime * 60);
            }
        } catch (error: any) {
            console.error("Error fetching questions:", error);
            toast({
                title: "Generation Failed",
                description: error.message || "Could not generate questions. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false); // Finished background generation
        }
    };

    const handleAnswerChange = (val: string) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = val;
        setAnswers(newAnswers);
    };

    const handleSubmitCode = () => {
        setSubmittedCodingIndices(prev => new Set(prev).add(currentQuestionIndex));
        handleNext();
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            setVisitedQuestions(prev => new Set(prev).add(nextIndex));

            if (!isOA) {
                setTranscript(""); // Reset transcript for interviews
                if (window.speechSynthesis) window.speechSynthesis.cancel();
            }
            setCode("");
            // If we want to persist draft code, we need a separate 'codes' array state. 
        } else {
            submitTest(answers);
        }
    };

    const jumpToQuestion = (index: number) => {
        setCurrentQuestionIndex(index);
        setVisitedQuestions(prev => new Set(prev).add(index));
    };

    const submitTest = async (finalAnswers: string[], disqualified: boolean = false) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setSubmitting(true);
        stopMediaTracks();

        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        try {
            // Evaluation Logic
            let calculatedScore = 0;
            // Basic scoring for MCQs in OA
            // Basic scoring for MCQs in OA
            if (isOA) {
                let correctCount = 0;
                questions.forEach((q, idx) => {
                    const userAns = finalAnswers[idx]?.toUpperCase();
                    if (q.type === 'multiple-choice' && userAns && q.correctAnswer) {
                        const rawCorrect = q.correctAnswer.trim();
                        let correctLetter = "";

                        // Strategy 1: Direct Letter "A" or "A." or "A)" or "Option A"
                        // Regex looks for start, optional "Option ", capturing group for A-D, optional dot/paren, end or space
                        const letterMatch = rawCorrect.match(/^(?:Option\s+)?([A-D])(?:[.)]|$)/i);

                        if (letterMatch) {
                            correctLetter = letterMatch[1].toUpperCase();
                        }
                        // Strategy 2: Content Match (if rawCorrect is the full text)
                        else if (q.options) {
                            const matchIndex = q.options.findIndex(opt =>
                                opt.trim().toLowerCase() === rawCorrect.toLowerCase() ||
                                rawCorrect.toLowerCase().includes(opt.trim().toLowerCase())
                            );
                            if (matchIndex !== -1) {
                                correctLetter = ["A", "B", "C", "D"][matchIndex];
                            }
                        }

                        if (userAns === correctLetter) {
                            correctCount++;
                        }
                    }
                });
                calculatedScore = Math.round((correctCount / questions.length) * 100);
            }

            const evaluation = await evaluateAnswers(role!, roundType, questions, finalAnswers); // Pass roundType directly
            const finalScore = isOA ? calculatedScore : (evaluation.score || 0);

            if (user) {
                // Map modern round types to legacy DB types to satisfy constraint
                // Constraint: CHECK (test_type IN ('aptitude', 'interview'))
                const dbTestType = isOA ? 'aptitude' : 'interview';

                // Preserve specific round info in job_role since we lose it in test_type
                const roundName = {
                    oa: "Online Assessment",
                    tech1: "Technical Round 1",
                    tech2: "Technical Round 2",
                    behavioral: "Behavioral Round",
                    hr: "HR Round",
                    aptitude: "Aptitude",
                    interview: "Interview"
                }[roundType] || roundType;

                const { error: insertError } = await supabase.from("test_attempts").insert({
                    user_id: user.id,
                    test_type: dbTestType,
                    job_role: `${role} | ${roundName}`, // Append round info
                    score: disqualified ? 0 : finalScore,
                    status: disqualified ? "disqualified" : "completed",
                    disqualification_reason: disqualified ? "malpractice" : null,
                    questions: questions as any,
                    answers: finalAnswers as any,
                    ai_feedback: {
                        feedback: evaluation.feedback,
                        score: evaluation.score,
                        questionScores: evaluation.questionScores
                    } as any // Wrap in object for JSONB compatibility
                });

                if (insertError) {
                    console.error("Supabase Insert Error:", insertError);
                    toast({ title: "Save Error", description: "Failed to save test result: " + insertError.message, variant: "destructive" });
                }

                // Force refresh of progress data
                queryClient.invalidateQueries({ queryKey: ["test-attempts", user.id] });
            } else {
                console.error("User not found during submission");
                toast({ title: "Error", description: "User session not found. Result not saved.", variant: "destructive" });
            }

            navigate("/progress", { state: { result: evaluation.feedback, score: finalScore } });

        } catch (error) {
            console.error("Error submitting:", error);
            toast({ title: "Error", description: "Submission failed.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    // Speech Utils - Consolidated
    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
        } else {
            initializeSpeech();
        }
    };

    const initializeSpeech = () => {
        if (!('webkitSpeechRecognition' in window)) {
            toast({ title: "Error", description: "Browser doesn't support speech recognition.", variant: "destructive" });
            return;
        }

        // Stop any existing recognition before starting a new one
        if (recognitionRef.current) recognitionRef.current.stop();

        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                const newText = transcript + " " + finalTranscript;
                setTranscript(newText);
                handleAnswerChange(newText.trim()); // Auto-update answer for interview
            }
        };
        recognitionRef.current = recognition;
        recognition.start();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --------------------------------------------------------------------------------
    // RENDER: SETUP PHASES
    // --------------------------------------------------------------------------------

    // Phase 1: Camera Check
    if (sessionPhase === 'setup-camera') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <Card className="w-full max-w-lg shadow-xl border-t-4 border-primary">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-display">System Check</CardTitle>
                        <CardDescription>Let's verify your camera checks out before we begin.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-6">
                        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/50">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                            {/* Face Frame Guide */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-[180px] h-[240px] border-2 border-white/30 rounded-full"></div>
                            </div>
                            <div className="absolute bottom-2 left-0 right-0 text-center">
                                <span className={cn("text-xs px-2 py-1 rounded bg-black/60 font-mono", stream ? "text-green-400" : "text-yellow-400")}>
                                    {stream ? "● Camera Active" : "● Waiting for stream..."}
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                            Please ensure you are well-lit and your face is clearly visible inside the oval.<br />
                            Background generation is running...
                        </p>
                        <Button onClick={captureSnapshot} size="lg" className="w-full gap-2" disabled={!stream}>
                            <div className="h-3 w-3 bg-current rounded-full animate-pulse" /> Capture & Continue
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Phase 2: Rules & Agreement
    if (sessionPhase === 'setup-rules') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <Card className="w-full max-w-2xl shadow-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-primary" /> Test Guidelines
                        </CardTitle>
                        <CardDescription>Please review the rules carefully. Violations will lead to disqualification.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="bg-muted/40 p-4 rounded-lg space-y-2">
                                <h4 className="font-semibold text-red-500 flex items-center gap-2">🚫 Prohibited</h4>
                                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                    <li>Switching tabs or windows</li>
                                    <li>Minimizing the browser</li>
                                    <li>Background noise or talking</li>
                                    <li>Moving out of camera frame</li>
                                </ul>
                            </div>
                            <div className="bg-muted/40 p-4 rounded-lg space-y-2">
                                <h4 className="font-semibold text-green-600 flex items-center gap-2">✅ Allowed</h4>
                                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                    <li>Using the provided code editor</li>
                                    <li>Drinking water (clear bottle)</li>
                                    <li>Thinking aloud (for interview)</li>
                                    <li>Looking at screen center</li>
                                </ul>
                            </div>
                        </div>

                        {userSnapshot && (
                            <div className="flex items-center gap-4 bg-primary/5 p-3 rounded-lg border border-primary/10">
                                <img src={userSnapshot} alt="User" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm" />
                                <div>
                                    <p className="text-sm font-medium">Identity Verified</p>
                                    <p className="text-xs text-muted-foreground">We'll use this snapshot to verify checking.</p>
                                </div>
                            </div>
                        )}

                        <div className="pt-4">
                            <Button onClick={startTest} size="lg" className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-all text-lg h-12" disabled={isGenerating}>
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing questions...
                                    </>
                                ) : (
                                    <>
                                        I Agree & Start Test <ArrowRight className="ml-2 h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // RENDER: ACTIVE SESSION (FALLTHROUGH)
    // If we are active but questions somehow failed or empty
    if (!questions.length && !isGenerating) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-muted-foreground">Failed to load questions.</p>
                    <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">Retry</Button>
                </div>
            </div>
        );
    }

    // Safety generic loader if active but still generating (shouldn't happen with button lock)
    if (isGenerating && !questions.length) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Preparing your session...</p>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const isCodingQuestion = currentQuestion.type === 'coding';


    // RENDER: ONLINE ASSESSMENT (OA) MODE
    if (isOA) {
        return (
            <div className="min-h-screen bg-background relative flex flex-col">
                {/* Header */}
                <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                    <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-display font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">InstaPrep</h1>
                            <p className="text-xs text-muted-foreground capitalize">Online Assessment</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/10 backdrop-blur rounded-full px-4 py-1.5 border border-primary/20 flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${timeLeft < 60 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                <span className="font-mono font-bold text-primary">{formatTime(timeLeft)}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-muted-foreground hover:text-primary">
                                {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-4 flex gap-4 overflow-hidden">


                    {/* Left Sidebar: Palette */}
                    <div className="w-1/4 hidden md:block">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Round 1: OA</CardTitle>
                                <CardDescription>Focus on accuracy & speed.</CardDescription>
                                {/* Camera Preview for OA Malpractice */}
                                <div className={`mt-4 rounded-lg overflow-hidden bg-black aspect-video w-full shadow-inner border transition-colors duration-300 relative ${warnings > 0 ? 'border-red-600 border-4' : 'border-primary/20'}`}>
                                    {/* Explicitly re-attach stream if not auto-handled */}
                                    <video ref={el => {
                                        if (el && stream) el.srcObject = stream;
                                        videoRef.current = el;
                                    }} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                                    {warnings > 0 && <div className="absolute inset-0 border-4 border-red-600 animate-pulse pointer-events-none"></div>}
                                    <div className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                                </div>
                                {warnings > 0 && <p className="text-xs text-red-500 font-bold mt-1 text-center animate-pulse">Warning: {warnings}/3</p>}
                                <p className="text-xs text-muted-foreground mt-2 text-center">Proctoring Active</p>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-4 gap-2">
                                    {questions.map((q, idx) => {
                                        const isVisited = visitedQuestions.has(idx);
                                        const isAnswered = q.type === 'coding' ? submittedCodingIndices.has(idx) : !!answers[idx];
                                        const isCurrent = currentQuestionIndex === idx;
                                        let bgClass = "bg-secondary";
                                        if (isCurrent) bgClass = "ring-2 ring-primary";
                                        else if (isVisited) {
                                            if (isAnswered) bgClass = "bg-green-500 text-white";
                                            else bgClass = "bg-destructive text-white";
                                        }
                                        return (
                                            <button key={idx} onClick={() => jumpToQuestion(idx)} className={cn("h-10 w-10 rounded-md flex items-center justify-center text-sm font-medium transition-all relative", bgClass)}>
                                                {idx + 1}
                                                {q.type === 'coding' && <span className="absolute -top-1 -right-1 h-2 w-2 bg-sky-500 rounded-full"></span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content OA */}
                    <div className="flex-1">
                        <Card className="w-full h-full shadow-card flex flex-col">
                            <CardHeader>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</span>
                                    <span className="md:hidden font-bold text-primary">{formatTime(timeLeft)}</span>
                                </div>
                                <CardTitle className="text-xl">{currentQuestion.question}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-6 flex flex-col overflow-y-auto">
                                {isCodingQuestion ? (
                                    <div className="flex flex-col flex-1 min-h-0 gap-4">
                                        <div className="bg-muted p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
                                            {currentQuestion.constraints && <p><strong>Constraints:</strong> {currentQuestion.constraints}</p>}
                                            {currentQuestion.testCases?.[0] && <p><strong>Example:</strong> {currentQuestion.testCases[0].input} -&gt; {currentQuestion.testCases[0].output}</p>}
                                        </div>
                                        <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
                                            <div className="bg-muted px-4 py-2 text-xs font-mono border-b flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Language:</span>
                                                    <Select value={language} onValueChange={handleLanguageChange}>
                                                        <SelectTrigger className="h-6 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="javascript">JavaScript</SelectItem>
                                                            <SelectItem value="python">Python</SelectItem>
                                                            <SelectItem value="java">Java</SelectItem>
                                                            <SelectItem value="cpp">C++</SelectItem>
                                                            <SelectItem value="c">C</SelectItem>
                                                            <SelectItem value="html">HTML</SelectItem>
                                                            <SelectItem value="css">CSS</SelectItem>
                                                            <SelectItem value="sql">SQL</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <Textarea value={code || currentQuestion.codeSnippet || ""} onChange={(e) => { setCode(e.target.value); handleAnswerChange(e.target.value); }} className="flex-1 font-mono text-sm p-4 border-none resize-none" placeholder="// Code here..." />
                                        </div>
                                        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs h-32 overflow-y-auto w-full">
                                            <div>CONSOLE</div>
                                            <pre>{isRunningCode ? "Running..." : (consoleOutput || "> Ready")}</pre>
                                        </div>
                                        <div className="flex justify-end gap-3">
                                            <Button variant="secondary" onClick={async () => {
                                                setIsRunningCode(true);
                                                const { runCodeWithAI } = await import("@/lib/gemini");
                                                const res = await runCodeWithAI(code || currentQuestion.codeSnippet || "", language, currentQuestion);
                                                setConsoleOutput(res.output + (res.error ? "\nError: " + res.error : ""));
                                                setIsRunningCode(false);
                                            }} disabled={isRunningCode}><Play className="w-4 h-4 mr-2" /> Run</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <RadioGroup value={answers[currentQuestionIndex] || ""} onValueChange={handleAnswerChange} className="space-y-3">
                                        {currentQuestion.options?.map((opt, i) => (
                                            <div key={i} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50">
                                                <RadioGroupItem value={["A", "B", "C", "D"][i]} id={`opt-${i}`} />
                                                <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer">{opt}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                )}
                                <div className="pt-6 flex justify-end mt-auto">
                                    <Button onClick={isCodingQuestion ? handleSubmitCode : handleNext} disabled={!answers[currentQuestionIndex] && !isLastQuestion} size="lg" variant="gradient">
                                        {submitting ? "Submitting..." : (isLastQuestion ? "Finish Test" : (isCodingQuestion ? "Submit Code & Next" : "Next"))}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

        );
    }

    // RENDER: INTERVIEW MODE
    // Logic: If 'requiresCoding' (checked via type='coding'), show Split View. Else show Center View.
    const showSplitView = isCodingQuestion;

    return (
        <div className="min-h-screen bg-background relative flex flex-col">
            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-display font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">PrepPal</h1>
                        <p className="text-xs text-muted-foreground capitalize">{roundType.replace("tech", "Technical Round ").replace("behavioral", "Managerial Round").replace("hr", "HR Round")}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 backdrop-blur rounded-full px-4 py-1.5 border border-primary/20 flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${timeLeft < 60 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <span className="font-mono font-bold text-primary">{formatTime(timeLeft)}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-muted-foreground hover:text-primary">
                            {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content Container */}
            <div className="flex-1 p-4 flex items-center justify-center">
                <div className={cn("w-full transition-all duration-500", showSplitView ? "max-w-[95vw] grid grid-cols-2 gap-4 h-[80vh]" : "max-w-3xl")}>

                    {/* Visual / Avatar / Video Card */}
                    <Card className={cn("shadow-card relative overflow-hidden flex flex-col", showSplitView ? "h-full" : "")}>
                        <CardHeader className="text-center">
                            {!showSplitView && (
                                <div className="mx-auto p-4 rounded-full mb-4 w-fit relative flex flex-col items-center">
                                    <div className={`mb-4 rounded-xl overflow-hidden bg-black aspect-video w-[240px] shadow-lg border-2 relative transition-all ${warnings > 0 ? 'border-red-600 shadow-red-500/50' : 'border-primary/20'}`}>
                                        <video ref={el => {
                                            if (el && stream) el.srcObject = stream;
                                            videoRef.current = el;
                                        }} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                                        <div className="absolute top-2 right-2 h-3 w-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                                    </div>
                                    {warnings > 0 && <p className="text-red-500 font-bold animate-pulse">Warning: {warnings}/10</p>}
                                    {isSpeaking && <p className="text-xs text-primary animate-pulse font-medium">Interviewer is speaking...</p>}
                                </div>
                            )}
                            {showSplitView && (
                                // Smaller video for split view
                                // Smaller video for split view - Fixed positioning to avoid obstruction
                                <div className={`w-[120px] rounded-lg overflow-hidden bg-black border shadow-xl mb-4 self-start ${warnings > 0 ? 'border-red-600 border-2' : 'border-white/20'}`}>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-20 object-cover transform scale-x-[-1]" />
                                </div>
                            )}
                            <CardTitle className={cn("font-display", showSplitView ? "text-xl text-left mt-20" : "text-2xl md:text-3xl")}>
                                {currentQuestion.question}
                            </CardTitle>
                            <CardDescription className={showSplitView ? "text-left" : ""}>
                                {isListening ? "Listening..." : "Processing..."}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="flex-1 flex flex-col">
                            <div className="bg-muted p-4 rounded-xl flex-1 relative overflow-y-auto">
                                <div className="absolute top-2 right-2 z-10">
                                    <Button
                                        variant={isListening ? "destructive" : "secondary"}
                                        size="sm"
                                        onClick={toggleListening}
                                        className={cn("gap-2 transition-all", isListening && "animate-pulse")}
                                    >
                                        <Mic className="h-3 w-3" /> {isListening ? "Listening..." : "Enable Voice"}
                                    </Button>
                                    <Button
                                        variant={screenStream ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={screenStream ? () => {
                                            screenStream.getTracks().forEach(track => track.stop());
                                            setScreenStream(null);
                                        } : startScreenShare}
                                        className="gap-2"
                                    >
                                        <Monitor className="h-3 w-3" /> {screenStream ? "Stop Share" : "Share Screen"}
                                    </Button>
                                </div>
                                <p className="text-lg leading-relaxed whitespace-pre-wrap">{transcript || <span className="text-muted-foreground italic">Start speaking your answer...</span>}</p>
                            </div>

                            {/* Screen Share Preview */}
                            {screenStream && (
                                <div className="mt-4 p-2 bg-black/5 rounded-lg border border-primary/20">
                                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                        You are sharing your screen
                                    </p>
                                    <video
                                        ref={el => {
                                            if (el) el.srcObject = screenStream;
                                        }}
                                        autoPlay playsInline muted
                                        className="w-full h-32 object-contain bg-black rounded border"
                                    />
                                </div>
                            )}

                            <div className="border-t pt-6 flex justify-end mt-4">
                                {!showSplitView && (
                                    <Button onClick={handleNext} disabled={submitting} size="lg" variant="gradient">
                                        {submitting ? "Evaluating..." : (isLastQuestion ? "Finish Interview" : "Next Question")}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Code Editor Side (Only visible if showSplitView) */}
                    {showSplitView && (
                        <Card className="shadow-card flex flex-col h-full animate-in slide-in-from-right-10">
                            <CardHeader className="py-3 border-b bg-muted/30">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold flex items-center gap-2"><div className="bg-primary/20 p-1 rounded"><Play className="h-3 w-3 text-primary" /></div> Live Coding Environment</span>
                                    <div className="flex items-center gap-2">
                                        <Select value={language} onValueChange={setLanguage}>
                                            <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="javascript">JavaScript</SelectItem>
                                                <SelectItem value="python">Python</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 flex flex-col">
                                <Textarea
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        handleAnswerChange("User submitted code: \n" + e.target.value); // Sync to answers for submission
                                    }}
                                    className="flex-1 border-none resize-none font-mono text-sm p-4 focus-visible:ring-0 rounded-none bg-background"
                                    placeholder="// Write your solution here. The interviewer is watching..."
                                />
                                <div className="h-32 bg-zinc-950 text-zinc-400 p-3 font-mono text-xs overflow-auto border-t">
                                    <div className="flex justify-between items-center mb-1">
                                        <span>TERMINAL</span>
                                        {isRunningCode && <Loader2 className="h-3 w-3 animate-spin" />}
                                    </div>
                                    <pre>{consoleOutput || "> Waiting for execution..."}</pre>
                                </div>
                                <div className="p-4 border-t flex justify-between bg-muted/30">
                                    <Button variant="secondary" size="sm" onClick={async () => {
                                        setIsRunningCode(true);
                                        const { runCodeWithAI } = await import("@/lib/gemini");
                                        const res = await runCodeWithAI(code, language, currentQuestion);
                                        setConsoleOutput(res.output + (res.error ? "\nError: " + res.error : ""));
                                        setIsRunningCode(false);
                                    }}>Run Tests</Button>

                                    <Button onClick={handleNext} size="sm" variant="default">
                                        Submit Solution
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

        </div>

    );
}
