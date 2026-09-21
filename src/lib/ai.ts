import { supabase } from "./supabase";

export async function createConversation(userId: string, title = "New Conversation") {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Derives a concise 2–6 word title from the user's first message.
 * Strips filler words, collapses whitespace, and title-cases the result.
 */
export function generateTitleFromMessage(message: string): string {
  if (!message || !message.trim()) return "New Conversation";

  // Remove leading imperative filler words that are not meaningful as titles
  const fillers = [
    /^(please\s+)?can\s+you\s+/i,
    /^please\s+/i,
    /^i\s+(want|need|would like)\s+(to\s+)?/i,
    /^help\s+me\s+(to\s+)?/i,
    /^could\s+you\s+/i,
  ];

  let cleaned = message.trim();
  for (const filler of fillers) {
    cleaned = cleaned.replace(filler, "");
  }

  // Keep only the first sentence (up to punctuation or newline)
  cleaned = cleaned.split(/[.!?\n]/)[0].trim();

  // Split into words and take up to 6
  const words = cleaned.split(/\s+/).filter(Boolean);
  const titleWords = words.slice(0, 6);

  if (titleWords.length === 0) return "New Conversation";

  // Title-case each word
  const title = titleWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return title;
}

/**
 * Updates the title of an existing ai_conversations record in Supabase.
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title })
    .eq("id", conversationId);

  if (error) {
    console.error("Failed to update conversation title:", error);
  }
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  message: string
) {
  if (!conversationId || conversationId === "conv-default" || conversationId.startsWith("conv-")) {
    console.warn("[saveMessage] Skipping save to Supabase: conversationId is not a database UUID:", conversationId);
    return;
  }

  const { error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      role,
      message,
    });

  if (error) throw error;
}

export async function getConversationMessages(conversationId: string) {
  if (!conversationId || conversationId === "conv-default" || conversationId.startsWith("conv-")) {
    return [];
  }

  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data;
}