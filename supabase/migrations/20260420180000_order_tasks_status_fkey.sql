-- Link order_tasks.status to task_statuses.name (FK replaces CHECK enum).

ALTER TABLE public.order_tasks
  DROP CONSTRAINT IF EXISTS order_tasks_status_check;

ALTER TABLE public.order_tasks
  DROP CONSTRAINT IF EXISTS order_tasks_status_fkey;

ALTER TABLE public.order_tasks
  ADD CONSTRAINT order_tasks_status_fkey
  FOREIGN KEY (status) REFERENCES public.task_statuses (name)
  ON UPDATE CASCADE;

INSERT INTO public.task_statuses (name, color, sort_order, company_id) VALUES
  ('Pending', '#94a3b8', 1, NULL),
  ('In Progress', '#3b82f6', 2, NULL),
  ('Design Approval', '#8b5cf6', 3, NULL),
  ('Design Revision', '#f59e0b', 4, NULL),
  ('Waiting for Print File', '#06b6d4', 5, NULL),
  ('Completed', '#22c55e', 6, NULL),
  ('Blocked', '#ef4444', 7, NULL)
ON CONFLICT (name) DO NOTHING;
