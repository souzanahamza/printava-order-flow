/** Supabase `.select()` fragment for designer task list rows (shared embed shape). */
export const DESIGN_TASK_LIST_SELECT = `
  id,
  order_id,
  order_item_id,
  company_id,
  task_type,
  status,
  assigned_to,
  started_at,
  completed_at,
  created_at,
  assigned_profile:profiles!order_tasks_assigned_to_fkey(full_name, email),
  order_item:order_items!order_tasks_order_item_id_fkey(
    quantity,
    product_id,
    product:products!order_items_product_id_fkey(
      name_en,
      name_ar,
      category,
      sku,
      image_url,
      product_code
    )
  ),
  order:orders!order_tasks_order_id_fkey(
    id,
    order_number,
    client_name,
    delivery_date,
    notes
  )
`;

/** Same joins as the designer pool, plus line-item fields needed for `ItemTaskDetailDialog`. */
export const ADMIN_DESIGN_TASK_LIST_SELECT = `
  id,
  order_id,
  order_item_id,
  company_id,
  task_type,
  status,
  assigned_to,
  started_at,
  completed_at,
  created_at,
  assigned_profile:profiles!order_tasks_assigned_to_fkey(full_name, email),
  order_item:order_items!order_tasks_order_item_id_fkey(
    id,
    order_id,
    quantity,
    unit_price,
    item_total,
    needs_design,
    product_id,
    product:products!order_items_product_id_fkey(
      name_en,
      name_ar,
      category,
      sku,
      image_url,
      product_code
    )
  ),
  order:orders!order_tasks_order_id_fkey(
    id,
    order_number,
    client_name,
    delivery_date,
    notes
  )
`;
