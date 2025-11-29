export type OrderDetail = {
    id: string;
    client_name: string;
    email: string;
    phone: string | null;
    delivery_date: string;
    delivery_method: string | null;
    status: string;
    total_price: number;
    notes: string | null;
    created_at: string;
    pricing_tier?: {
        name: string;
        label: string;
    } | null;
    order_items: Array<{
        id: string;
        quantity: number;
        unit_price: number;
        item_total: number;
        product: {
            name_en: string;
            name_ar: string;
            image_url: string | null;
            sku: string;
        };
    }>;
};

export type OrderAttachment = {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
    file_size: number | null;
    created_at: string;
    uploader_id?: string;
    uploader_name?: string;
    uploader_role?: string;
};
