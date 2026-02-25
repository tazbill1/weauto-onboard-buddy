import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, department, extractedTopics, mode, programName } = await req.json();

    const departmentContext = department
      ? `The user is building an onboarding program for the "${department.label}" department at an automotive dealership. ${department.description || ""}. Typical program duration for this department is ${department.typical_duration_days || "flexible"} days.`
      : "";

    const topicsContext =
      extractedTopics && extractedTopics.length > 0
        ? `Topics extracted so far from uploaded materials and conversation: ${JSON.stringify(extractedTopics)}`
        : "No topics extracted yet.";

    let systemPrompt = "";

    if (mode === "generate") {
      systemPrompt = `You are an expert automotive dealership training program designer. ${departmentContext}

${topicsContext}

The user is ready for you to generate a complete onboarding program. Based on all the topics and materials provided, create a structured program.

You MUST respond with ONLY a valid JSON object (no markdown, no backticks, no explanation before or after). The JSON must follow this exact structure:

{
  "program_name": "${programName || "Onboarding Program"}",
  "total_days": <number>,
  "days": [
    {
      "day_number": 1,
      "title": "Day title",
      "subtitle": "Optional subtitle",
      "phase": "Phase name",
      "tasks": [
        {
          "section": "learn",
          "title": "Task title",
          "description": "Brief description",
          "content_html": "<p>Detailed training content in HTML. Be thorough and practical. Include specific procedures, tips, and examples relevant to the dealership.</p>",
          "requires_upload": false,
          "requires_rating": true,
          "sort_order": 1
        }
      ]
    }
  ],
  "suggestions": [
    {
      "topic": "Missing topic name",
      "reason": "Why this should be included",
      "suggested_day": 3
    }
  ]
}

Rules for generation:
- section must be one of: learn, practice, mastery_homework, manager_checkin
- Every day MUST have at least one manager_checkin task as the last task
- Balance tasks across days (3-6 tasks per day)
- Put foundational/orientation content in early days
- Put advanced/integration content in later days
- Include practical exercises in the practice section, not just reading
- The content_html should be detailed enough for someone to actually learn from it (multiple paragraphs with specific procedures and examples)
- Add 2-4 suggestions for topics that were NOT covered in the provided materials but are important for this department
- Respond with ONLY the JSON object, nothing else`;
    } else if (mode === "refine") {
      systemPrompt = `You are an expert automotive dealership training program designer. ${departmentContext}

${topicsContext}

The user has a draft program and wants to make changes. Help them refine it. If they ask to add, remove, move, or modify tasks or days, describe what you would change clearly. If they confirm, respond with the complete updated program JSON using the same structure as before (the full JSON with all days and tasks, not just the changed parts).

When responding conversationally (not producing JSON), be helpful and specific. Reference day numbers and task names when discussing changes.`;
    } else {
      systemPrompt = `You are an expert automotive dealership training program designer working inside an onboarding platform called WerkandMe. ${departmentContext}

${topicsContext}

You are helping the user build a structured onboarding program. Your job is to:

1. Welcome them and explain you can help build their program from documents, descriptions, or both
2. As they share information (upload documents, describe processes, paste links), acknowledge what you received and extract key training topics
3. After each input, briefly summarize the topics you extracted and ask if they have more to add
4. When they indicate they have shared everything, tell them you are ready to generate their program and ask them to confirm

Keep responses concise and conversational. Use short paragraphs, not long lists. Be encouraging but professional. Reference specific topics they have shared to show you understand their content.

When extracting topics from user messages, identify:
- Specific skills or procedures (e.g., "write-up process", "MPI walkthrough")
- Tools or systems (e.g., "CDK DMS", "CRM")
- Soft skills (e.g., "customer greeting", "upselling")
- Compliance or certifications (e.g., "OEM certification", "safety training")

After acknowledging each input, end with a question like "What else should we include?" or "Anything else, or are you ready for me to build the program?"`;
    }

    // Convert messages to OpenAI format
    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 8000,
        messages: openaiMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || "API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const assistantMessage = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message: assistantMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
