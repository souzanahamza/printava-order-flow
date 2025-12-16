import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get and validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create a client using the caller's JWT to verify their identity and role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the current user from the JWT
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !caller) {
      console.error('Failed to authenticate caller:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated caller:', caller.id);

    // Verify the caller has admin role using the user_roles table
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', caller.id)
      .single();

    if (roleError || !callerRole) {
      console.error('Failed to fetch caller role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify user role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerRole.role !== 'admin') {
      console.error('Caller is not an admin:', callerRole.role);
      return new Response(
        JSON.stringify({ error: 'Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerCompanyId = callerRole.company_id;
    console.log('Caller is admin of company:', callerCompanyId);

    // Parse request body
    const { email, password, fullName, role, companyId } = await req.json();

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, fullName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role is one of the allowed values
    const allowedRoles = ['sales', 'designer', 'production', 'accountant'];
    if (!allowedRoles.includes(role)) {
      console.error('Invalid role requested:', role);
      return new Response(
        JSON.stringify({ error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force the company ID to match the caller's company (ignore any provided companyId)
    const targetCompanyId = callerCompanyId;
    console.log('Creating user in company:', targetCompanyId, 'with role:', role);

    // Create user with admin client
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-verify email
      user_metadata: {
        full_name: fullName,
        role: role,
        company_id: targetCompanyId
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', userData.user?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: userData.user 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-user-direct function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
