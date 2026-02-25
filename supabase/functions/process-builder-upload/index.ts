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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { uploadId, sessionId } = await req.json();

    // Get the upload record
    const { data: upload, error: uploadErr } = await supabase
      .from("builder_uploads")
      .select("*")
      .eq("id", uploadId)
      .single();

    if (uploadErr || !upload) {
      return new Response(JSON.stringify({ error: "Upload not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the file from storage
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("builder-uploads")
      .download(upload.file_path);

    if (fileErr || !fileData) {
      return new Response(JSON.stringify({ error: "Could not download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedText = "";

    // For PDFs, send to AI for extraction
    if (upload.file_type === "application/pdf" || upload.file_name.endsWith(".pdf")) {
      const text = await fileData.text();
      // Use AI to extract training-relevant content
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: `Extract all training-relevant content from this document text. Include: topic names, procedures, skills, key concepts, and any structured content like checklists or steps. Format as a clear summary organized by topic area. Be thorough but concise.\n\nDocument content:\n${text.substring(0, 50000)}`,
            },
          ],
        }),
      });

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || "Could not extract text from PDF";
    }
    // For text files, read directly
    else if (upload.file_type === "text/plain" || upload.file_name.endsWith(".txt")) {
      extractedText = await fileData.text();
    }
    // For other file types, try reading as text
    else {
      try {
        extractedText = await fileData.text();
      } catch {
        extractedText =
          "Could not extract text from this file type. File was uploaded: " + upload.file_name;
      }
    }

    // Update the upload record with extracted text
    await supabase
      .from("builder_uploads")
      .update({ extracted_text: extractedText, processed: true })
      .eq("id", uploadId);

    return new Response(JSON.stringify({ success: true, extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
