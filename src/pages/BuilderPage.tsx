import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/hooks/useOnboardingData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Send, Paperclip, MoreVertical, X, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachment?: string;
}

interface SessionData {
  id: string;
  department_id: string;
  program_name: string | null;
  status: string;
  messages: ChatMessage[];
  extracted_topics: string[];
  draft_program: any;
}

export default function BuilderPage() {
  useEffect(() => { document.title = "AI Builder — WEAuto"; }, []);
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: departments } = useDepartments();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const department = departments?.find((d) => d.id === session?.department_id);

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("builder_sessions" as any)
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error || !data) {
        toast({ title: "Session not found", variant: "destructive" });
        navigate("/content-admin");
        return;
      }
      const s = data as any;
      setSession({
        id: s.id,
        department_id: s.department_id,
        program_name: s.program_name,
        status: s.status,
        messages: (s.messages as ChatMessage[]) || [],
        extracted_topics: (s.extracted_topics as string[]) || [],
        draft_program: s.draft_program,
      });
      setLoading(false);
    };
    load();
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  // Initial greeting
  useEffect(() => {
    if (session && session.messages.length === 0 && department && !sending) {
      sendToAI([], "chat");
    }
  }, [session?.id, department]);

  const updateSession = useCallback(async (updates: Partial<SessionData>) => {
    if (!sessionId) return;
    await supabase
      .from("builder_sessions" as any)
      .update(updates as any)
      .eq("id", sessionId);
    setSession((prev) => prev ? { ...prev, ...updates } : prev);
  }, [sessionId]);

  const sendToAI = async (msgs: ChatMessage[], mode: string) => {
    if (!department) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("builder-chat", {
        body: {
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          department: { label: department.label, description: department.description, typical_duration_days: department.typical_duration_days },
          extractedTopics: session?.extracted_topics || [],
          mode,
          programName: session?.program_name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const aiMsg: ChatMessage = { role: "assistant", content: data.message };
      const updated = [...msgs, aiMsg];
      await updateSession({ messages: updated as any });

      if (mode === "generate") {
        // Try to parse JSON from response
        try {
          const jsonMatch = data.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const draft = JSON.parse(jsonMatch[0]);
            await updateSession({ draft_program: draft, status: "reviewing", messages: updated as any });
            return;
          }
        } catch {
          // Not valid JSON, keep as reviewing with message
        }
        await updateSession({ status: "reviewing", messages: updated as any });
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = { role: "assistant", content: "⚠️ Something went wrong. Please try again." };
      const updatedWithError = [...msgs, errorMsg];
      await updateSession({ messages: updatedWithError as any });
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !selectedFile) || sending || !session) return;

    let userContent = inputText.trim();
    let attachment: string | undefined;

    // Handle file upload
    if (selectedFile) {
      try {
        const filePath = `${sessionId}/${Date.now()}_${selectedFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("builder-uploads")
          .upload(filePath, selectedFile);
        if (uploadErr) throw uploadErr;

        // Insert upload record
        const { data: uploadRecord, error: insertErr } = await supabase
          .from("builder_uploads" as any)
          .insert({
            session_id: sessionId,
            file_name: selectedFile.name,
            file_type: selectedFile.type,
            file_path: filePath,
            file_size: selectedFile.size,
          } as any)
          .select("id")
          .single();
        if (insertErr) throw insertErr;

        // Process upload
        const { data: processResult } = await supabase.functions.invoke("process-builder-upload", {
          body: { uploadId: (uploadRecord as any).id, sessionId },
        });

        const extractedText = processResult?.extractedText || "";
        userContent = `I uploaded a document called "${selectedFile.name}". Here is the extracted content:\n\n${extractedText}\n\n${userContent}`;
        attachment = selectedFile.name;
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
      setSelectedFile(null);
    }

    if (!userContent) return;

    const userMsg: ChatMessage = { role: "user", content: userContent, attachment };
    const updated = [...session.messages, userMsg];
    await updateSession({ messages: updated as any });
    setInputText("");
    await sendToAI(updated, "chat");
  };

  const handleGenerate = async () => {
    if (!session || sending) return;
    // Add a synthetic confirmation message so the AI knows to produce JSON
    const confirmMsg: ChatMessage = { role: "user", content: "Yes, generate the complete onboarding program now." };
    const updatedMsgs = [...session.messages, confirmMsg];
    await updateSession({ status: "generating", messages: updatedMsgs as any });
    await sendToAI(updatedMsgs, "generate");
  };

  const handleAbandon = async () => {
    await updateSession({ status: "abandoned" });
    navigate("/content-admin");
  };

  const statusLabel: Record<string, string> = {
    active: "Adding Content",
    generating: "Generating…",
    reviewing: "Review Draft",
    completed: "Published",
    abandoned: "Abandoned",
  };

  const userMsgCount = session?.messages.filter((m) => m.role === "user").length || 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 h-14 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/content-admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {department && (
          <Badge variant="outline" className="shrink-0">{department.label}</Badge>
        )}
        <span className="text-sm text-muted-foreground flex-1 truncate">
          {statusLabel[session?.status || "active"]}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAbandon} className="text-destructive">
              Abandon Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Generate button bar */}
      {userMsgCount >= 2 && session?.status === "active" && (
        <div className="px-4 py-2 border-b bg-muted/30 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleGenerate}
            disabled={sending}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Program
          </Button>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {session?.messages.map((msg, i) => {
          // Hide raw JSON responses (generated program drafts)
          const isJsonResponse = msg.role === "assistant" && msg.content.trimStart().startsWith("{") && msg.content.includes('"days"');
          if (isJsonResponse) {
            return (
              <div key={i} className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground italic">
                  ✅ Program draft generated successfully.
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
                  }`}
              >
                {msg.attachment && (
                  <div className="text-xs opacity-70 mb-1">📎 {msg.attachment}</div>
                )}
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-2 [&_p:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {msg.attachment
                      ? msg.content.split("\n\n").slice(0, 1).join("") || `Uploaded ${msg.attachment}`
                      : msg.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {session?.status === "generating" ? "Building your program…" : "Thinking…"}
            </div>
          </div>
        )}

        {session?.status === "reviewing" && (
          <div className="flex justify-center py-4 gap-3">
            {session.draft_program ? (
              <Button onClick={() => navigate(`/builder/${sessionId}/review`)} className="gap-2">
                <Sparkles className="h-4 w-4" /> View Draft Program
              </Button>
            ) : (
              <Button variant="outline" onClick={() => {
                updateSession({ status: "active" });
              }} className="gap-2">
                <Sparkles className="h-4 w-4" /> Retry Generation
              </Button>
            )}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      {(session?.status === "active" || session?.status === "reviewing") && (
        <div className="border-t bg-card px-4 py-3 shrink-0">
          {selectedFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-muted rounded-lg text-sm">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{selectedFile.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Describe what new hires need to learn..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={sending}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sending || (!inputText.trim() && !selectedFile)}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
