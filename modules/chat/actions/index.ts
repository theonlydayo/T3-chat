"use server";
import { prisma } from "@/lib/db";
import { MessageRole, MessageType } from "@/lib/generated/prisma/enums";
import { currentUser } from "@/modules/authentication/actions";
import { success } from "better-auth";
import { revalidatePath } from "next/cache";

interface IcreateChatWithMessage {
  content: string;
  model: string;
}

export async function createChatWithMessage({
  content,
  model,
}: IcreateChatWithMessage) {
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");

    const chat = await prisma.chat.create({
      data: {
        title,
        model,
        userId: user?.id,
        messages: {
          create: {
            content,
            model,
            messageRole: MessageRole.USER,
            messageType: MessageType.NORMAL,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    revalidatePath("/", "page");
    return { success: true, data: chat };
  } catch (error) {
    console.error("Error creating chat:", error);
    return { success: false, message: "Failed to create chat" };
  }
}

export async function getAllChats() {
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    const chats = await prisma.chat.findMany({
      where: { userId: user?.id },
      include: { messages: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: chats };
  } catch (error) {
    console.error("Error fetching chats:", error);
    return { success: false, message: "Failed to fetch chats" };
  }
}

export async function getChatById(chatId: string) {
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId, userId: user?.id },
      include: { messages: true },
    });

    return { success: true, data: chat };
  } catch (error) {
    console.error("Error fetching chat:", error);
    return { success: false, message: "Failed to fetch chat" };
  }
}


export async function deleteChat(chatId:string){
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    const chat = await prisma.chat.delete({
      where: { id: chatId, userId: user?.id },
    
    });

    if(!chat) {
        return {
            success:false,
            message:"Chat not found"
        }
    }

    return { success: true};
  } catch (error) {
    console.error("Error deleting chat:", error);
    return { success: false, message: "Failed to delete chat" };
  }
}