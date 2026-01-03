import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobRole, testType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating ${testType} questions for role: ${jobRole}`);

    let systemPrompt = "";
    let userPrompt = "";

    if (testType === "aptitude") {
      systemPrompt = "You are an expert aptitude test designer. Generate 20 challenging multiple choice questions. Also calculate the expected time in minutes to solve them, add 10 minutes to it, and round it to the nearest integer.";
      userPrompt = `I am preparing for the role of ${jobRole} so generate 20 questions.

For each question, provide:
1. The question text
2. 4 multiple choice options (A, B, C, D)
3. The correct answer letter
4. A brief explanation

Format your response as a JSON object with:
- "questions": array of objects { question, options (array of 4 string values), correctAnswer (A/B/C/D), explanation }
- "timeLimit": integer (expected time + 10 mins, rounded)
`;
    } else {
      systemPrompt = "You are an expert interviewer. Generate a list of interview questions.";
      userPrompt = `I am preparing for the role of ${jobRole}. Generate some random interview questions based on it.

Include:
- Technical questions
- Behavioral questions
- Problem-solving scenarios

Format your response as a JSON array of objects containing: 
- question: string
- type: 'technical' | 'behavioral' | 'scenario'
- focusArea: string (what this tests)`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      // ... (Error handling omitted for brevity, but I should include it. Wait, I must include full file content or this will be truncated/broken.
      // I will copy the original error handling logic.)
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Extract JSON from the response
    let result;
    try {
      // Clean content (sometimes has markdown block)
      const cleanContent = content.replace(/```json\n?|\n?```/g, "");
      const jsonMatch = cleanContent.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }

    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse questions from AI response");
    }

    // Normalize output structure
    let questions = [];
    let timeLimit = 30; // Default fallback

    if (Array.isArray(result)) {
      questions = result;
    } else if (result.questions) {
      questions = result.questions;
      if (result.timeLimit) timeLimit = result.timeLimit;
    }

    console.log(`Successfully generated ${questions.length} questions`);

    return new Response(JSON.stringify({ questions, timeLimit }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating questions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
