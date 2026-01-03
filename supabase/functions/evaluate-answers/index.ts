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
    const { jobRole, testType, questions, answers } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Evaluating ${testType} answers for role: ${jobRole}`);

    const systemPrompt = "You are an expert interviewer and career coach. Evaluate the candidate's answers and provide constructive feedback.";
    
    const userPrompt = `The candidate is preparing for a ${jobRole} position. They completed a ${testType === 'aptitude' ? 'aptitude test' : 'mock interview'}.

Here are the questions and their answers:

${questions.map((q: any, i: number) => `
Question ${i + 1}: ${q.question || q}
Answer: ${answers[i] || 'No answer provided'}
`).join('\n')}

Please evaluate their performance and provide:
1. Overall score out of 100
2. Strengths demonstrated
3. Areas for improvement
4. Specific tips for each question where they could improve
5. Sample better answers for questions they struggled with

Format your response as JSON with: score (number), strengths (array of strings), improvements (array of strings), questionFeedback (array of objects with: questionIndex, rating (good/average/needs-improvement), feedback, sampleAnswer).`;

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
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
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
    let feedback;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a basic feedback structure if parsing fails
      feedback = {
        score: 70,
        strengths: ["Completed the assessment"],
        improvements: ["Practice more questions"],
        questionFeedback: []
      };
    }

    console.log(`Evaluation complete. Score: ${feedback.score}`);

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error evaluating answers:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
