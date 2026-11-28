import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const taskPlanningFields = {
  plannedDate: z.iso.date().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  effort: z.enum(["small", "medium", "large"]).optional(),
};

const storedTask = z.looseObject({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  dueDate: z.iso.date().optional(), 
  ...taskPlanningFields,
  // 旧清单可能已用数字保存优先级，读写时保留原值。
  priority: z.union([taskPlanningFields.priority, z.number()]),
  parentId: z.string().optional(),
});
const taskList = z.array(storedTask);
type Task = z.infer<typeof storedTask>;
type TaskChanges = Partial<
  Pick<Task, "title" | "done" | "dueDate" | "plannedDate" | "priority" | "effort">
>;
const taskSchedule = z.object({ dueDate: z.iso.date().optional(), ...taskPlanningFields });
type TaskSchedule = z.infer<typeof taskSchedule>;
type SubtaskInput = TaskSchedule & { title: string };

export const protectedTaskMessage = "这个任务下还有子任务，请先删除下属子任务。";

export interface TaskStore {
  list(): Task[];
  create(title: string, dueDate?: string, plan?: Omit<TaskSchedule, "dueDate">): Task;
  createSubtasks(parentId: string, subtasks: SubtaskInput[]): Task[];
  update(id: string, changes: TaskChanges): Task | undefined;
  remove(id: string): "deleted" | "not_found" | "has_children";
}

export function createJsonTaskStore(filename: string): TaskStore {
  function list(): Task[] {
    if (!existsSync(filename)) return [];
    return taskList.parse(JSON.parse(readFileSync(filename, "utf8")));
  }

  // 同一服务进程内同步完成读写；替换文件前，原清单始终完整可读。
  function save(tasks: Task[]) {
    mkdirSync(dirname(filename), { recursive: true });
    const temporary = filename + ".tmp";
    writeFileSync(temporary, JSON.stringify(tasks, null, 2) + "\n");
    renameSync(temporary, filename);
  }

  return {
    list,

    create(title, dueDate, plan) {
      const task = { id: randomUUID(), title, done: false, dueDate, ...plan };
      save([...list(), task]);
      return task;
    },
     createSubtasks(parentId, subtasks) {
      const tasks = list();
      const children = subtasks.map((subtask) => ({
        id: randomUUID(),
        ...subtask,
        done: false,
        parentId,
      }));

      save([...tasks, ...children]);
      return children;
    },
    update(id, changes) {
      const tasks = list();
      const task = tasks.find((item) => item.id === id);
      if (!task) return undefined;

      Object.assign(task, changes);
      save(tasks);
      return task;
    },

    remove(id) {
      const tasks = list();
      const remaining = tasks.filter((task) => task.id !== id);
      if (remaining.length === tasks.length) return "not_found";
      if (remaining.some((task) => task.parentId === id)) return "has_children";

      save(remaining);
      return "deleted";
    },
  };
}
