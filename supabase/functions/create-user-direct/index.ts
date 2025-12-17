import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    // IMPORTANT: always return 200 so supabase-js doesn't surface this as a fatal FunctionsHttpError
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get and validate authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return json({ success: false, error: "Authorization required" });
    }

    // Create admin client for privileged operations
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

    // Create a client using the caller's JWT to verify their identity and role
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

    // Get the current user from the JWT
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !caller) {
      console.error("Failed to authenticate caller:", authError);
      return json({ success: false, error: "Invalid or expired token" });
    }

    console.log("Authenticated caller:", caller.id);

    // Verify the caller has admin role using the user_roles table
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", caller.id)
      .single();

    if (roleError || !callerRole) {
      console.error("Failed to fetch caller role:", roleError);
      return json({ success: false, error: "Unable to verify user role" });
    }

    if (callerRole.role !== "admin") {
      console.error("Caller is not an admin:", callerRole.role);
      return json({ success: false, error: "Only admins can create users" });
    }

    const callerCompanyId = callerRole.company_id;
    console.log("Caller is admin of company:", callerCompanyId);

    // Parse request body
    const { email, password, fullName, role } = await req.json();

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return json({
        success: false,
        error: "Missing required fields: email, password, fullName, role",
      });
    }

    // Validate role is one of the allowed values
    const allowedRoles = ["sales", "designer", "production", "accountant"];
    if (!allowedRoles.includes(role)) {
      console.error("Invalid role requested:", role);
      return json({
        success: false,
        error: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
      });
    }

    // Force the company ID to match the caller's company
    const targetCompanyId = callerCompanyId;
    console.log("Creating user in company:", targetCompanyId, "with role:", role);

    // Create user with admin client
    const { data: userData, error: createError } = await supabaseAdmin.auth
      .admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          company_id: targetCompanyId,
        },
      });

    if (createError) {
      console.error("Error creating user:", createError);
      const anyErr = createError as any;
      return json({
        success: false,
        error: createError.message,
        code: anyErr?.code ?? null,
      });
    }

    console.log("User created successfully:", userData.user?.id);
    return json({ success: true, user: userData.user });
  } catch (error) {
    console.error("Error in create-user-direct function:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
