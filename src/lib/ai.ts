import { supabase } from "./supabase";

export async function createConversation(userId: string) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title: "New Conversation",
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  message: string
) {
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
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data;
}