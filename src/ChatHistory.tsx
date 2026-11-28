import { useEffect, useRef } from "react";
import type { DisplayMessage, TaskListItem } from "../shared/chat.ts";

const examplePrompts = ["提醒我买牛奶", "看看我的待办"];

interface ChatHistoryProps {
  messages: DisplayMessage[];
  pending: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export function ChatHistory({ messages, pending, onSelectPrompt }: ChatHistoryProps) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [messages, pending]);

  return (
    <div className="scroll" ref={viewport}>
      {messages.length === 0 ? (
        <section className="welcome">
          <img src="/logo.png" alt="" />
          <h1>小明智能体</h1>
          <p>今天有什么待办？</p>
          <div className="examples">
            {examplePrompts.map((prompt) => (
              <button key={prompt} onClick={() => onSelectPrompt(prompt)}>
                {prompt}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="thread" role="log" aria-label="对话记录" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <small>{message.role === "user" ? "你" : "小明智能体"}</small>
              <div>
                {message.taskList && message.todayPlanDate ? (
                  <TodayPlan tasks={message.taskList} date={message.todayPlanDate} />
                ) : message.taskList ? (
                  <TaskChecklist tasks={message.taskList} />
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          {pending && <p role="status">正在回复…</p>}
        </div>
      )}
    </div>
  );
}

function TaskTitle({ task, detail = false }: { task: TaskListItem; detail?: boolean }) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${now.getFullYear()}-${month}-${day}`;
  const isOverdue = !task.done && !!task.dueDate && task.dueDate < today;

  return (
    <span>
      <span aria-hidden="true">{task.done ? "✓ " : "○ "}</span>
      <span aria-label={task.done ? "已完成" : "待完成"} role="img" />
      {task.done ? <del style={{ color: "#667085" }}>{task.title}</del> : task.title}
      {task.dueDate && (
        <span className={`task-deadline${detail ? " task-detail" : ""}${isOverdue ? " task-overdue" : ""}`}>
          {detail ? "" : " · "}
          {isOverdue ? "已逾期 · " : ""}
          截止 {task.dueDate}
        </span>
      )}
    </span>
  );
}

function TaskChecklist({ tasks }: { tasks: TaskListItem[] }) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const groups = tasks
    .filter((task) => !task.parentId || !taskIds.has(task.parentId))
    .map((task) => {
      const children = tasks.filter((child) => child.parentId === task.id);
      const pendingChildren = children.filter((child) => !child.done);
      const completedChildren = children.filter((child) => child.done);
      const pendingTasks = task.done ? pendingChildren : [task, ...pendingChildren];
      const isComplete = task.done && pendingChildren.length === 0;
      const datedTasks = isComplete ? [task, ...children] : pendingTasks;
      const earliestDueDate = datedTasks
        .flatMap((item) => (item.dueDate ? [item.dueDate] : []))
        .sort()[0];

      const byDueDate = (a: TaskListItem, b: TaskListItem) =>
        (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");

      return {
        task,
        children: [...pendingChildren.sort(byDueDate), ...completedChildren.sort(byDueDate)],
        remaining: pendingChildren.length,
        earliestDueDate,
      };
    });

  const byGroupDueDate = (a: (typeof groups)[number], b: (typeof groups)[number]) =>
    (a.earliestDueDate ?? "9999-12-31").localeCompare(b.earliestDueDate ?? "9999-12-31");

  const active = groups
    .filter(({ task, remaining }) => !task.done || remaining > 0)
    .sort(byGroupDueDate);

  const completed = groups
    .filter(({ task, remaining }) => task.done && remaining === 0)
    .sort(byGroupDueDate);

  return (
    <div aria-label="任务清单" style={{ whiteSpace: "normal" }}>
      {[
        { heading: "待完成", entries: active },
        { heading: `已完成（${completed.length}）`, entries: completed },
      ].map(({ heading, entries }) =>
        entries.length === 0 ? null : (
          <section key={heading}>
            <strong>{heading}</strong>
            <ul style={{ listStyle: "none", paddingInlineStart: 0, margin: "6px 0 12px" }}>
              {entries.map(({ task, children, remaining }) => (
                <li key={task.id}>
                  <TaskTitle task={task} />
                  <TaskBadges task={task} showPriority />
                  {task.done && remaining > 0 && (
                    <span> · 还有 {remaining} 项子任务待完成</span>
                  )}
                  {children.length > 0 && (
                    <ul style={{ listStyle: "none", paddingInlineStart: "1.25rem" }}>
                      {children.map((child) => (
                        <li key={child.id}>
                          <TaskTitle task={child} />
                          <TaskBadges task={child} showPriority />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

const priorityLabels = { high: "高", medium: "中", low: "低" };
const effortLabels = { small: "小", medium: "中", large: "大" };
const priorities = ["high", "medium", "low"] as const;

function TaskBadges({ task, showPriority = false }: {
  task: TaskListItem;
  showPriority?: boolean;
}) {
  return (
    <>
      {showPriority && task.priority && (
        <span className="task-badge">{priorityLabels[task.priority]}优先级</span>
      )}
      {task.effort && <span className="task-badge">工作量 {effortLabels[task.effort]}</span>}
    </>
  );
}

function PlanRows({ tasks, showOriginalDate = false }: {
  tasks: TaskListItem[];
  showOriginalDate?: boolean;
}) {
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>
          <span className="plan-task-text">
            <TaskTitle task={task} detail />
            {task.parentTitle && (
              <span className="task-detail">所属主任务 · {task.parentTitle}</span>
            )}
            {showOriginalDate && (
              <span className="task-detail">原计划 · {task.plannedDate}</span>
            )}
          </span>
          <TaskBadges task={task} showPriority={showOriginalDate} />
        </li>
      ))}
    </ul>
  );
}

function TodayPlan({ tasks, date }: { tasks: TaskListItem[]; date: string }) {
  const dueToday = tasks
    .filter((task) => task.dueDate === date)
    .sort(
      (a, b) =>
        priorities.indexOf(a.priority ?? "medium") -
        priorities.indexOf(b.priority ?? "medium"),
    );
  const scheduled = tasks.filter(
    (task) => task.dueDate !== date && task.plannedDate === date,
  );
  const carried = tasks.filter(
    (task) => task.dueDate !== date && task.plannedDate && task.plannedDate < date,
  );

  return (
    <section className="today-plan" aria-label="今日行动清单">
      <strong>今日行动清单 · {date}</strong>
      <span className="task-detail">
        {tasks.length > 0
          ? `今天到期 ${dueToday.length} 项，另有 ${scheduled.length} 项安排`
          : "今天没有待处理任务"}
      </span>

      {dueToday.length > 0 && (
        <section className="plan-group">
          <strong className="plan-group-title">今天到期</strong>
          <PlanRows tasks={dueToday} />
        </section>
      )}

      {scheduled.length > 0 && (
        <section className="plan-group">
          <strong>今天安排</strong>
          {priorities.map((priority) => {
            const items = scheduled
              .filter((task) => (task.priority ?? "medium") === priority)
              .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"));
            if (items.length === 0) return null;

            return (
              <section className="plan-group" data-priority={priority} key={priority}>
                <strong className="plan-group-title">
                  {priorityLabels[priority]}优先级
                </strong>
                <PlanRows tasks={items} />
              </section>
            );
          })}
        </section>
      )}

      {carried.length > 0 && (
        <section className="plan-group">
          <strong className="plan-group-title">
            之前计划但未完成（{carried.length}）
          </strong>
          <PlanRows tasks={carried} showOriginalDate />
        </section>
      )}
    </section>
  );
}