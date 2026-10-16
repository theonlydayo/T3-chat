"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import React, {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGetChatById } from "../../hooks/use-chats";
import { useAIModels } from "../../hooks/use-ai-models";
import { Spinner } from "@/components/ui/spinner";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";

import { ModelSelector } from "../chat-view/model-selector";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

import { toast } from "sonner";

type DBMessage = {
  id: string;
  content: string;
  messageRole: "USER" | "ASSISTANT";
  createdAt: string | Date;
};

type MessagePartShape = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

function parseMessageToUI(msg: DBMessage): UIMessage {
  const basePart: MessagePartShape = {
    type: "text",
    text: msg.content,
  };

  let parts: MessagePartShape[];

  try {
    const parsed: unknown = JSON.parse(msg.content);

    parts =
      Array.isArray(parsed) &&
      parsed.every(
        (part): part is MessagePartShape =>
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          typeof part.type === "string",
      )
        ? parsed
        : [basePart];
  } catch {
    parts = [basePart];
  }

  return {
    id: msg.id,
    role: msg.messageRole.toLowerCase() as "user" | "assistant",
    parts: parts as UIMessage["parts"],
  };
}

function MessagePart({
  part,
  messageId,
  partIndex,
  role,
  isStreaming,
}: {
  part: MessagePartShape;
  messageId: string;
  partIndex: number;
  role: UIMessage["role"];
  isStreaming: boolean;
}) {
  const key = `${messageId}-${partIndex}`;

  if (part.type === "text") {
    return (
      <Message from={role} key={key}>
        <MessageContent>
          <MessageResponse>{part.text ?? ""}</MessageResponse>
        </MessageContent>
      </Message>
    );
  }

  if (part.type === "reasoning") {
    return (
      <Reasoning
        className="max-w-2xl px-4 py-4 border border-muted rounded-md bg-muted/50"
        key={key}
        isStreaming={isStreaming}
      >
        <ReasoningTrigger />
        <ReasoningContent className="mt-2 italic font-light text-muted-foreground">
          {part.text ?? ""}
        </ReasoningContent>
      </Reasoning>
    );
  }

  if (part.type === "step-start" && partIndex > 0) {
    return (
      <div key={key} className="my-4 text-gray-500">
        <hr className="border-gray-300" />
      </div>
    );
  }

  return null;
}

export const MessageViewWithForm = ({
  chatId,
}: {
  chatId: string;
}) => {
  const { data: chatData, isPending } = useGetChatById(chatId);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!chatData?.success || !chatData?.data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Chat Not Found
      </div>
    );
  }

  const rawMessages: DBMessage[] = chatData.data.messages ?? [];

  const initialMessages: UIMessage[] = rawMessages
    .filter((message) => message?.id && message?.content?.trim())
    .map(parseMessageToUI);

  return (
    <ChatView
      chatId={chatId}
      initialMessages={initialMessages}
      initialModel={chatData.data.model}
    />
  );
};

const ChatView = ({
  chatId,
  initialMessages,
  initialModel,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  initialModel: string | null;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoTrigger = searchParams.get("autoTrigger") === "true";
  const hasAutoTriggered = useRef(false);

  const [selectedModel, setSelectedModel] = useState<string | null>(
    initialModel,
  );

  const { data: modelsData, isPending: isModelLoading } = useAIModels();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );

  const { messages, status, sendMessage, regenerate, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
      toast.error(err.message);
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!shouldAutoTrigger) return;
    if (hasAutoTriggered.current) return;
    if (!selectedModel) return;
    if (messages.length === 0) return;
    if (messages.at(-1)?.role !== "user") return;

    hasAutoTriggered.current = true;

    regenerate({
      body: {
        chatId,
        model: selectedModel,
        skipUserMessage: true,
      },
    }).catch((err: unknown) => {
      console.error("Auto-trigger failed:", err);
      toast.error("Failed to generate response");
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("autoTrigger");

    const query = params.toString();

    router.replace(`/chat/${chatId}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [
    shouldAutoTrigger,
    selectedModel,
    messages,
    chatId,
    regenerate,
    router,
    searchParams,
  ]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text?.trim();

    if (!text) return;

    if (!selectedModel) {
      toast.error("Please select a model first");
      return;
    }

    if (isBusy) return;

    try {
      await sendMessage(
        { text },
        {
          body: {
            chatId,
            model: selectedModel,
            skipUserMessage: false,
          },
        },
      );
    } catch (error: unknown) {
      console.error("Send message failed:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-[calc(100vh-4rem)]">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="Start the conversation"
                description="Send a message to get started."
              />
            ) : (
              messages.map((message) => (
                <Fragment key={message.id}>
                  {message.parts.map((part, index) => (
                    <MessagePart
                      key={`${message.id}-${index}`}
                      part={part as MessagePartShape}
                      messageId={message.id}
                      partIndex={index}
                      role={message.role}
                      isStreaming={
                        isBusy &&
                        message === messages.at(-1) &&
                        index === message.parts.length - 1
                      }
                    />
                  ))}
                </Fragment>
              ))
            )}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner />
                <span className="text-sm">AI is thinking...</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive">
                {error.message || "Something went wrong."}
              </div>
            )}
          </ConversationContent>

          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4">
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Type your message..."
              disabled={isBusy}
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools className="flex items-center justify-between gap-2 w-full">
              <div className="flex-1">
                {isModelLoading ? (
                  <Spinner />
                ) : (
                  <ModelSelector
                    models={modelsData?.models ?? []}
                    selectedModelId={selectedModel ?? undefined}
                    onModelSelect={setSelectedModel}
                    className=""
                  />
                )}
              </div>

              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};