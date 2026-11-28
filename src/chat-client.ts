import type { ChatMessage, ChatReply } from "../shared/chat.ts";

export async function requestReply(messages: ChatMessage[]): Promise<ChatReply> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const body: unknown = await response.json();

  if (typeof body === "object" && body !== null) {
    if (response.ok && "reply" in body && typeof body.reply === "string") {
      const answer: ChatReply = { reply: body.reply };

      if ("taskList" in body && Array.isArray(body.taskList)) {
        answer.taskList = body.taskList;
      }

      if ("todayPlanDate" in body && typeof body.todayPlanDate === "string") {
        answer.todayPlanDate = body.todayPlanDate;
      }
      return answer;
    }

    if ("error" in body && typeof body.error === "string") {
      throw new Error(body.error);
    }
  }

  throw new Error("服务暂时无法处理请求，请稍后重试。");
}
