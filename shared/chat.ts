import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
});

export type ChatMessage = z.infer<typeof messageSchema>;

export const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1)
    .refine((messages) => messages.at(-1)?.role === "user"),
});

export type TaskListItem = {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  parentId?: string;
  parentTitle?: string;
  plannedDate?: string;
  priority?: "high" | "medium" | "low";
  effort?: "small" | "medium" | "large";
};

export type ChatReply = {
  reply: string;
  todayPlanDate?: string;
  taskList?: TaskListItem[];
};

export type DisplayMessage = ChatMessage & {
  todayPlanDate?: string;
  taskList?: TaskListItem[];
};
