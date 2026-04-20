/** Rows needed to filter designer-facing attachments (matches Production line + order-wide logic). */
export type DesignerOrderAttachmentRow = {
  id: string;
  order_id: string;
  order_item_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  created_at: string | null;
};

export function isOrderLevelAttachment(row: { order_item_id: string | null }): boolean {
  return row.order_item_id == null;
}

/**
 * Item-specific: `order_item_id === task.order_item_id`.
 * Order-wide: same `order_id` and `order_item_id` is null.
 */
export function filterAttachmentsForDesignLineItem(
  task: { order_id: string; order_item_id: string },
  rows: DesignerOrderAttachmentRow[]
): { clientReferences: DesignerOrderAttachmentRow[]; designMockups: DesignerOrderAttachmentRow[] } {
  const clientReferences: DesignerOrderAttachmentRow[] = [];
  const designMockups: DesignerOrderAttachmentRow[] = [];

  for (const r of rows) {
    if (r.order_id !== task.order_id) continue;
    const itemMatch = r.order_item_id === task.order_item_id;
    const orderWide = r.order_item_id == null;
    if (!itemMatch && !orderWide) continue;

    if (r.file_type === "client_reference") clientReferences.push(r);
    else if (r.file_type === "design_mockup") designMockups.push(r);
  }

  return { clientReferences, designMockups };
}
