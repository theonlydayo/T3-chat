"use client";

import React, { useState, useEffect } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useAIModels } from "../../hooks/use-ai-models";
import { ModelSelector } from "./model-selector";
import { useCreateChat } from "../../hooks/use-chats";

type ChatMessageFormProps = {
  initialMessage?: string;
  onMessageChange?: (message: string) => void;
};

export default function ChatMessageForm({
  initialMessage,
  onMessageChange,
}: ChatMessageFormProps) {
  const { data: models, isPending } = useAIModels();
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    undefined,
  );

  const { mutateAsync, isPending: isChatPending } = useCreateChat();

  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
      onMessageChange?.("");
    }
  }, [initialMessage, onMessageChange]);

  useEffect(() => {
    if (!selectedModel && models?.models?.length) {
      setSelectedModel(models.models[0].id);
    }
  }, [models, selectedModel]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();

    if (!message.trim() || !selectedModel || isChatPending) {
      return;
    }

    try {
      await mutateAsync({
        content: message,
        model: selectedModel,
      });

      toast.success("Message sent successfully");
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative"
      >
        <div className="relative rounded-2xl border border-border shadow-sm transition-all">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="min-h-15px max-h-50px resize-none border-0 bg-transparent px-4 py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t">
            <div className="flex items-center gap-1">
              {isPending ? (
                <Spinner />
              ) : (
                <ModelSelector
                  models={models?.models}
                  selectedModelId={selectedModel}
                  onModelSelect={setSelectedModel}
                  className="ml-1"
                />
              )}
            </div>

            <Button
              type="submit"
              disabled={
                !message.trim() || !selectedModel || isChatPending
              }
              size="sm"
              variant={message.trim() ? "default" : "ghost"}
              className="h-8 w-8 p-0 rounded-full"
              aria-label="Send message"
              title={
                message.trim()
                  ? "Send message"
                  : "Enter a message to enable"
              }
            >
              {isChatPending ? (
                <Spinner />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send message</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}