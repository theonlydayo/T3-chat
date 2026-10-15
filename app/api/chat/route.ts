import { convertToModelMessages, streamText , createIdGenerator , type UIMessage } from "ai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompt";
import { prisma } from "@/lib/db";
import { MessageRole } from "@/lib/generated/prisma/enums";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { NextRequest } from "next/server";

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/**
 * Convert DB message to UI format for AI SDK
 */
function dbMessageToUI(msg) {
  try {
    const parts = JSON.parse(msg.content);
    const textParts = parts.filter((p) => p.type === "text");

    if (textParts.length === 0) return null;

    return {
      id: msg.id,
      role: msg.messageRole.toLowerCase(),
      parts: textParts,
      createdAt: msg.createdAt,
    };
  } catch {
    return {
      id: msg.id,
      role: msg.messageRole.toLowerCase(),
      parts: [{ type: "text", text: msg.content }],
      createdAt: msg.createdAt,
    };
  }
}

const generateMessageId = createIdGenerator({prefix:"msg" , size:16})

/**
 * Convert message parts to JSON string for DB storage
 */
function partsToJSON(message: { parts?: unknown; content?: string }) {
  if (Array.isArray(message.parts)) {
    return JSON.stringify(message.parts);
  }
  return JSON.stringify([{ type: "text", text: message.content ?? "" }]);
}



export async function POST(req: NextRequest) {
  try {
    const {
      chatId,
      messages,
      model,
      skipUserMessage,
    } = await req.json();

  

    const result = streamText({
      model: openRouter.chat(model),
      system: CHAT_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
    });

    result.consumeStream();

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      originalMessages: messages,
      generateMessageId,
      onFinish: async ({ responseMessage }) => {
        try {
          const messageToSave:Array<{
                 id?: string;
            chatId: string;
            content: string;
            messageRole: MessageRole;
            messageType: "NORMAL";
            model: string;
          }> = [];

          if (!skipUserMessage) {
              const lastUserMsg = [...messages]
              .reverse()
              .find((m) => m.role === "user");
            if (lastUserMsg) {
              messageToSave.push({
                id:lastUserMsg.id,
                chatId,
                content: partsToJSON(lastUserMsg),
                messageRole: MessageRole.USER,
                messageType: "NORMAL",
                model,
              });
            }
          }

          if (responseMessage?.parts?.length > 0) {
            messageToSave.push({
              id:responseMessage.id,
              chatId,
              content: partsToJSON(responseMessage),
              messageRole: MessageRole.ASSISTANT,
              messageType: "NORMAL",
              model,
            });
          }

          if(messageToSave.length > 0){
            await prisma.message.createMany({data:messageToSave , skipDuplicates:true})
          }
        } catch (error) {
            console.error("Error saving messages" , error)
        }
      },
    });
  } catch (error) {
     console.error("Chat API error:", error);
    return Response.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}


