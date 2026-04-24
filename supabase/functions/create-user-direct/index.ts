import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_ROLES = ["sales", "designer", "production"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return json({ success: false, error: "Authorization required" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !caller) {
      console.error("Failed to authenticate caller:", authError);
      return json({ success: false, error: "Invalid or expired token" });
    }

    const { data: callerAdminRows, error: callerRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("company_id")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .limit(1);

    if (callerRoleError || !callerAdminRows?.length) {
      console.error("Caller is not an admin:", callerRoleError);
      return json({ success: false, error: "Only admins can create users" });
    }

    const callerCompanyId = callerAdminRows[0].company_id as string;

    const body = await req.json();
    const { email, password, fullName, role, roles: rolesRaw } = body;

    let roles: string[];
    if (Array.isArray(rolesRaw) && rolesRaw.length > 0) {
      roles = [...new Set(rolesRaw.map((r: unknown) => String(r)))];
    } else if (typeof role === "string" && role) {
      roles = [role];
    } else {
      return json({
        success: false,
        error: "Missing required field: roles (array) or role (string)",
      });
    }

    if (!email || !password || !fullName) {
      return json({
        success: false,
        error: "Missing required fields: email, password, fullName",
      });
    }

    if (roles.length === 0) {
      return json({ success: false, error: "Select at least one role" });
    }

    for (const r of roles) {
      if (!ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number])) {
        return json({
          success: false,
          error: `Invalid role "${r}". Allowed: ${ALLOWED_ROLES.join(", ")}`,
        });
      }
    }

    const targetCompanyId = callerCompanyId;
    const primaryRole = roles[0];

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: primaryRole,
        company_id: targetCompanyId,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      const anyErr = createError as { code?: string };
      return json({
        success: false,
        error: createError.message,
        code: anyErr?.code ?? null,
      });
    }

    const newUserId = userData.user?.id;
    if (!newUserId) {
      return json({ success: false, error: "User created but ID missing" });
    }

    for (const r of roles.slice(1)) {
      const { error: insertErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: newUserId,
        role: r,
        company_id: targetCompanyId,
      });
      if (insertErr) {
        console.error("Failed to insert additional role:", insertErr);
        return json({
          success: false,
          error: `User created but failed to assign role "${r}": ${insertErr.message}`,
        });
      }
    }

    console.log("User created with roles:", roles.join(", "));
    return json({ success: true, user: userData.user });
  } catch (error) {
    console.error("Error in create-user-direct function:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
