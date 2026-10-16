"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import UserButton from "@/modules/authentication/components/user-button";
import { PlusIcon, SearchIcon, EllipsisIcon, Trash } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";
import type { MouseEvent } from "react";
import {
  isToday,
  isYesterday,
  isWithinInterval,
  subDays,
} from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "next/navigation";
import DeleteChatModel from "@/components/delete-chat-model";
import { useGetChats } from "../hooks/use-chats";
import { Spinner } from "@/components/ui/spinner";

type ChatMessage = {
  content: string;
};

type Chat = {
  id: string;
  title: string;
  createdAt: Date | string;
  messages?: ChatMessage[];
};

type ChatGroups = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  older: Chat[];
};

type ChatItemProps = {
  chat: Chat;
  isActive: boolean;
  onDelete: (event: MouseEvent, chatId: string) => void;
};

type ChatGroupProps = {
  label: string;
  chats: Chat[];
  activeChatId: string | null;
  onDelete: (event: MouseEvent, chatId: string) => void;
};

type ChatSidebarProps = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    createdAt: Date | string;
  };
};

function groupChatsByDate(chats: Chat[]): ChatGroups {
  const groups: ChatGroups = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  const now = new Date();

  if (!Array.isArray(chats)) return groups;

  chats.forEach((chat) => {
    try {
      const date =
        chat.createdAt instanceof Date
          ? chat.createdAt
          : new Date(chat.createdAt);

      if (Number.isNaN(date.getTime())) {
        groups.older.push(chat);
      } else if (isToday(date)) {
        groups.today.push(chat);
      } else if (isYesterday(date)) {
        groups.yesterday.push(chat);
      } else if (
        isWithinInterval(date, {
          start: subDays(now, 7),
          end: now,
        })
      ) {
        groups.lastWeek.push(chat);
      } else {
        groups.older.push(chat);
      }
    } catch (error) {
      console.error("Error processing chat date:", error, chat);
      groups.older.push(chat);
    }
  });

  return groups;
}

const DATE_GROUPS: {
  key: keyof ChatGroups;
  label: string;
}[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "lastWeek", label: "Last 7 Days" },
  { key: "older", label: "Older" },
];

function ChatItem({ chat, isActive, onDelete }: ChatItemProps) {
  return (
    <Link
      href={`/chat/${chat.id}`}
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
        isActive && "bg-sidebar-accent",
      )}
    >
      <span className="truncate flex-1">{chat.title}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 hover:bg-sidebar-accent-foreground/10"
            onClick={(event) => event.preventDefault()}
          >
            <EllipsisIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-red-500 cursor-pointer"
            onClick={(event) => onDelete(event, chat.id)}
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Link>
  );
}

function ChatGroup({
  label,
  chats,
  activeChatId,
  onDelete,
}: ChatGroupProps) {
  if (chats.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
        {label}
      </div>

      {chats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={chat.id === activeChatId}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

const ChatSidebar = ({ user }: ChatSidebarProps) => {
  const { data: chats = [], isPending } = useGetChats();
  const pathname = usePathname();

  const activeChatId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;

    const query = searchQuery.toLowerCase();

    return chats.filter(
      (chat: Chat) =>
        chat.title?.toLowerCase().includes(query) ||
        chat.messages?.some((msg) =>
          msg.content?.toLowerCase().includes(query),
        ),
    );
  }, [searchQuery, chats]);

  const groupedChats = useMemo(
    () => groupChatsByDate(filteredChats),
    [filteredChats],
  );

  const handleDelete = (event: MouseEvent, chatId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedChatId(chatId);
    setIsModalOpen(true);
  };

  if (isPending) {
    return <Spinner className="m-auto" />;
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center border-b border-sidebar-border px-4 py-3">
        <Image src="/logo.svg" alt="Logo" width={100} height={100} />
      </div>

      <div className="p-4">
        <Button asChild className="w-full">
          <Link href="/">
            <PlusIcon className="mr-2 h-4 w-4" />
            New Chat
          </Link>
        </Button>
      </div>

      <div className="px-4 pb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search your threads..."
            className="pl-9 pr-8 bg-sidebar-accent border-sidebar-border"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {filteredChats.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            {searchQuery ? "No chats found" : "No chats yet"}
          </div>
        ) : (
          DATE_GROUPS.map((group) => (
            <ChatGroup
              key={group.key}
              label={group.label}
              chats={groupedChats[group.key]}
              activeChatId={activeChatId}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <div className="p-4 flex items-center gap-3 border-t border-sidebar-border">
        <UserButton user={user} />

        <span className="flex-1 text-sm text-sidebar-foreground truncate">
          {user.email}
        </span>
      </div>

      <DeleteChatModel
        chatId={selectedChatId ?? ""}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      />
    </div>
  );
};

export default ChatSidebar;