import { Router } from "express";
import { z } from "zod";
import { protectedTaskMessage, type TaskStore } from "./task-store.ts";

const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  dueDate: z.iso.date().optional(),
});
const updateTaskSchema = createTaskSchema
  .omit({ dueDate: true })
  .partial()
  .extend({ done: z.boolean().optional() })
  .refine((changes) => Object.keys(changes).length > 0);

const taskNotFound = { error: "找不到这条任务。" };

export function taskRouter(tasks: TaskStore) {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(tasks.list());
  });

  router.post("/", (req, res) => {
    const input = createTaskSchema.safeParse(req.body);
    if (!input.success) {
           return res.status(400).json({
        error: "请提供 1 至 200 个字符的任务标题。截止日期可省略，填写时请使用 YYYY-MM-DD 格式。",
      });
    }
       res.status(201).json(tasks.create(input.data.title, input.data.dueDate));
  });

  router.patch("/:id", (req, res) => {
    const input = updateTaskSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ error: "请提供有效的 title 或 done 字段。" });
    }

    const updated = tasks.update(req.params.id, input.data);
    if (!updated) return res.status(404).json(taskNotFound);
    res.json(updated);
  });

  router.delete("/:id", (req, res) => {
    const result = tasks.remove(req.params.id);
    if (result === "not_found") return res.status(404).json(taskNotFound);
    if (result === "has_children") return res.status(409).json({ error: protectedTaskMessage });
    res.sendStatus(204);
  });

  return router;
}
