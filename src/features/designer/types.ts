/** Row shape from designer task list query (Supabase embeds + aliases). */
export type DesignerTaskListRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  company_id: string;
  task_type: string;
  status: string;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_profile: { full_name: string | null; email: string | null } | null;
  order_item: {
    quantity: number;
    product_id: string;
    product: {
      name_en: string;
      name_ar: string;
      category: string;
      sku: string;
      image_url: string | null;
      product_code: string | null;
    } | null;
  } | null;
  order: {
    id: string;
    order_number: number | null;
    client_name: string;
    delivery_date: string;
    notes: string | null;
  } | null;
};

/** Admin monitor query includes full line item + `product_code` for `ItemTaskDetailDialog`. */
export type AdminDesignTaskRow = Omit<DesignerTaskListRow, "order_item"> & {
  order_item: {
    id: string;
    order_id: string;
    quantity: number;
    unit_price: number;
    item_total: number;
    needs_design: boolean | null;
    product_id: string;
    product: {
      name_en: string;
      name_ar: string;
      category: string;
      sku: string;
      image_url: string | null;
      product_code: string | null;
    } | null;
  } | null;
};

export type DesignerTaskCardTask = DesignerTaskListRow | AdminDesignTaskRow;
