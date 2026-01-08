
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!GEMINI_API_KEY) {
    console.error("Missing VITE_GEMINI_API_KEY in .env file");
}
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface GeminiQuestion {
    question: string;
    options?: string[]; // For aptitude (MCQ)
    correctAnswer?: string; // For aptitude (MCQ)
    explanation?: string; // For aptitude
    type?: "multiple-choice" | "technical" | "behavioral" | "coding"; // Expanded types
    // For Coding Questions:
    codeSnippet?: string;
    testCases?: { input: string; output: string }[];
    constraints?: string;
    expectedTopics?: string[]; // For interview
}

export interface GeminiEvaluation {
    feedback: string;
    score?: number; // Optional score for aptitude
    questionScores?: number[]; // New: Granular scores
}

export type RoundType = "oa" | "tech1" | "tech2" | "behavioral" | "hr";

export const generateQuestions = async (
    role: string,
    round: RoundType, // Changed from type to round
    param: number = 20, // count for OA, duration (mins) for others
    difficulty: string = "Medium" // New Parameter
): Promise<{ questions: GeminiQuestion[]; timeLimit?: number }> => {

    let systemPrompt = "";
    let userPrompt = "";
    let count = param; // Default assumption for OA

    // For interviews, calculate approximate question count based on duration
    // Assume ~3 mins per question for technical, ~2 for behavioral
    if (round !== "oa") {
        const minsPerQ = (round === "tech1" || round === "tech2") ? 3 : 2;
        count = Math.max(3, Math.floor(param / minsPerQ));
    }

    if (round === "oa") {
        // Online Assessment (OA) - Aptitude + Coding + MCQs
        // Param is explicitly 'count' here
        const codingCount = count > 30 ? 2 : (count > 15 ? 1 : 0);
        const mcqCount = count - codingCount;

        systemPrompt = `You are an expert Online Assessment (OA) creator. Generate a screening test for ${role}.
    Difficulty: ${difficulty}.
    Source: Competitive Programming (Codeforces/LeetCode) + CS Fundamentals (GATE/Placement Papers).
    
    Structure:
    - Total Items: EXACTLY ${count}.
    - Coding Challenges: EXACTLY ${codingCount} (Data Structures & Algorithms).
    - MCQs: EXACTLY ${mcqCount} (CS Basics, OOP, DBMS, Debugging, Aptitude).
    
    CRITICAL: 
    1. Coding questions MUST include 'codeSnippet', 'testCases', and 'constraints'.
    2. Coding questions must be at the END of the list.`;

        userPrompt = `Generate ${count} OA items for ${role}. JSON Format.`;

    } else if (round === "tech1") {
        // Technical Round 1 - Core Skills
        systemPrompt = `You are a Technical Interviewer (Round 1). Generate ${count} core technical questions for ${role}.
    Difficulty: ${difficulty}.
    Focus:
    - Programming Basics (Python/Java/C++)
    - DSA (Arrays, Strings, Trees, Recursion)
    - Basic System Design
    
    CRITICAL:
    1. If a question requires writing code (e.g., "Write a function to..."), set "type": "coding" and provide "codeSnippet".
    2. Mix of conceptual and problem-solving questions.`;

        userPrompt = `Generate ${count} Round 1 interview questions for ${role}. JSON Format.`;

    } else if (round === "tech2") {
        // Technical Round 2 - Avanced
        systemPrompt = `You are a Senior Engineer (Round 2). Generate ${count} advanced technical questions for ${role}.
    Difficulty: ${difficulty}.
    Focus:
    - Advanced DSA (Graphs, DP, Tries)
    - Scalable System Design & Architecture
    - Threading, Concurrency, Low-level details.
    
    CRITICAL:
    1. Include at least 1 complex system design scenario.
    2. Questions should probe depth of knowledge.`;

        userPrompt = `Generate ${count} Round 2 interview questions for ${role}. JSON Format.`;

    } else if (round === "behavioral") {
        // Managerial - Culture Fit
        systemPrompt = `You are a Hiring Manager. Generate ${count} behavioral questions for ${role}.
    Focus: Culture, Team Conflicts, Leadership, Failures.
    
    CRITICAL:
    1. The FIRST question MUST be EXACTLY: "Tell me about yourself and your background."
    2. Questions should be situational (STAR method).`;

        userPrompt = `Generate ${count} behavioral interview questions. JSON Format.`;

    } else if (round === "hr") {
        // HR Round
        systemPrompt = `You are an HR Manager. Generate ${count} HR round questions.
    Focus: Salary, Relocation, Policy, Joining Date, Career Goals.
    
    CRITICAL:
    1. Keep questions professional and standard for an HR discussion.`;

        userPrompt = `Generate ${count} HR questions. JSON Format.`;
    }

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt + "\n\nResponse Format (JSON): { \"questions\": [ { \"question\": \"...\", \"type\": \"technical\"|\"coding\"|\"behavioral\"|\"multiple-choice\", \"options\": [], \"correctAnswer\": \"...\", \"explanation\": \"...\", \"codeSnippet\": \"...\" } ], \"expectedTime\": 15 } \nCRITICAL: Calculate expectedTime based on difficulty. Return just the number in minutes." }] }],
            }),
        });

        // ... Handle Response ...
        if (!response.ok) {
            const errorBody = await response.text();
            let errorMessage = `Gemini API Error: ${response.status} ${response.statusText}`;
            try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.error && errorJson.error.message) {
                    errorMessage += ` - ${errorJson.error.message}`;
                }
            } catch (e) {
                // If response isn't JSON, just use the status text
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        console.log("Gemini Raw Response:", text); // Debug log

        // Robust JSON Extraction
        // Find first '{' or '['
        const firstOpenBrace = text.indexOf('{');
        const firstOpenBracket = text.indexOf('[');
        let startIndex = firstOpenBrace;

        if (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) {
            startIndex = firstOpenBracket;
        }

        // Find last '}' or ']'
        const lastCloseBrace = text.lastIndexOf('}');
        const lastCloseBracket = text.lastIndexOf(']');
        let endIndex = lastCloseBrace;

        if (lastCloseBracket !== -1 && (lastCloseBrace === -1 || lastCloseBracket > lastCloseBrace)) {
            endIndex = lastCloseBracket;
        }

        if (startIndex === -1 || endIndex === -1) {
            throw new Error("No JSON found in response");
        }

        const jsonString = text.substring(startIndex, endIndex + 1);

        let resultRaw;
        try {
            resultRaw = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("JSON Parse Failure:", parseError, "String:", jsonString);
            throw new Error("Invalid format received from AI");
        }

        let result = resultRaw;

        // Robust handling: If AI returns array, wrap it
        if (Array.isArray(resultRaw)) {
            result = { questions: resultRaw };
        }

        // Validate structure
        if (!result.questions || !Array.isArray(result.questions)) {
            // Fallback: maybe the object itself is a question? Unlikely but safely handle
            throw new Error("Invalid Question Format");
        }

        // Post-Processing
        result.questions = result.questions.map((q: any) => ({
            ...q,
            type: q.type || (round === 'oa' ? 'multiple-choice' : 'technical') // Default fallback
        }));

        // Time Calculation: 
        // For Interviews (non-OA): The 'param' IS the user-selected duration. We must respect it.
        // For OA: The 'param' is question count, so we rely on AI's estimate or a fallback heuristic.
        const aiTime = round !== 'oa' ? param : (result.expectedTime ? Math.round(result.expectedTime) : Math.ceil(param * 1.5));

        return {
            questions: result.questions,
            timeLimit: aiTime
        };

    } catch (error) {
        console.error("Gemini Generation Error:", error);
        throw error;
    }
};

export const evaluateAnswers = async (
    role: string,
    type: RoundType,
    questions: GeminiQuestion[],
    answers: string[]
): Promise<GeminiEvaluation> => {

    const prompt = `
    You are a Senior Interviewer evaluating a candidate's submission for a ${type} round (${role}).
    
    Candidate's Answers:
    ${questions.map((q, i) => `Q${i + 1} [${q.type}]: ${q.question}\nExpected: ${q.correctAnswer || q.expectedTopics?.join(", ") || "Code Solution"}\nCandidate Answer: ${answers[i] || "Skipped"}`).join("\n\n")}
    
    TASK: 
    1. Provide a concise performance assessment (max 3-4 sentences).
    2. Assign a score (0-10) for EACH question based on correctness and quality.
    
    STYLE GUIDELINES (CRITICAL):
    1. Act as an Interviewer giving a verdict.
    2. Be specific: "The candidate performed well on X but struggled with Y." or "Answer to Q2 was incorrect because..."
    3. DO NOT give a generic "study guide" or list of topics to prepare. Focus ONLY on how they performed on THESE specific questions.
    4. Mention if the code was efficient or if the behavioral answer lacked depth.
    
    Response Format (JSON):
    {
      "feedback": "Your evaluation here...",
      "score": 0-100,
      "questionScores": [8, 5, 0, 10] // Array of scores matching question order (Max 10 per question)
    }
    `;

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        if (!response.ok) throw new Error("API Error");

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
        const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return { feedback: text, score: 0 };
    } catch (error) {
        console.error("Gemini Evaluation Error:", error);
        return { feedback: "Evaluation failed.", score: 0 };
    }
};

// New Function: Run Code with AI
export const runCodeWithAI = async (
    code: string,
    language: string = "javascript",
    question: GeminiQuestion
): Promise<{ passed: boolean; output: string; error?: string }> => {

    if (!code || !code.trim()) {
        return { passed: false, output: "", error: "No code provided" };
    }

    const prompt = `
    Act as a code compiler and tester.
    Question: ${question.question}
    Constraints: ${question.constraints || "None"}
    Test Cases: ${JSON.stringify(question.testCases)}
    
    Candidate Code (${language}):
    ${code}
    
    Task:
    1. Analyze if the code solves the problem correctly.
    2. "Run" the code against the provided test cases (simulate execution).
    3. Check for syntax errors or logic bugs.
    
    Response Format (JSON):
    {
      "passed": true/false,
      "output": "Output of the run (e.g., 'Test Case 1: Passed, Test Case 2: Passed')",
      "error": "Error message if any, else null"
    }
    `;

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        if (!response.ok) throw new Error("Compilation API Error");

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
        const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return { passed: false, output: "Raw Output: " + text, error: "Failed to parse compiler response" };

    } catch (error) {
        console.error("Gemini Compiler Error:", error);
        return { passed: false, output: "", error: "Compiler Service Unavailable" };
    }
};

export const verifyFaceMatch = async (
    baselineImage: string,
    currentImage: string
): Promise<{ match: boolean; confidence: number; error?: string }> => {

    if (!baselineImage || !currentImage) return { match: false, confidence: 0, error: "Missing image data" };

    const cleanBaseline = baselineImage.split(',')[1] || baselineImage;
    const cleanCurrent = currentImage.split(',')[1] || currentImage;

    const prompt = `
    Compare the face in Image A (Baseline) with Image B (Current).
    Strictly determine if they are the SAME person.
    Ignore minor variations (glasses, angle, lighting).
    Return JSON: { "match": true/false, "confidence": 0.0-1.0 }
    If face not visible in B, match: false.
    `;

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: cleanBaseline } },
                        { inline_data: { mime_type: "image/jpeg", data: cleanCurrent } }
                    ]
                }]
            }),
        });

        if (!response.ok) throw new Error("Vision API Error");
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return { match: !!result.match, confidence: result.confidence || 0 };
        }
        return { match: false, confidence: 0, error: "Parse Error" };
    } catch (error) {
        console.error("Gemini Vision Error:", error);
        return { match: true, confidence: 0, error: "Service Error" }; // Fail safe
    }
};
