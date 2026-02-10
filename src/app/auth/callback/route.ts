import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteCode = searchParams.get("invite");
  const nextParam = searchParams.get("next") ?? "/app";
  // Prevent open redirect: only allow relative paths starting with /
  const next = /^\/[a-zA-Z0-9/_-]*$/.test(nextParam) ? nextParam : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Ensure profile exists (trigger may not have fired yet for Google OAuth)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingProfile) {
          // Create profile manually if trigger didn't fire
          await supabase.from("profiles").upsert({
            id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "사용자",
            email: user.email,
            auth_provider: user.app_metadata?.provider || "google",
            avatar_url: user.user_metadata?.avatar_url || null,
          });
        }

        // If there's an invite code, process it
        if (inviteCode) {
          // Try RPC function first
          const { data: rpcResult, error: rpcError } = await supabase
            .rpc("use_invite_code", { invite_code: inviteCode.toUpperCase(), for_user_id: user.id });

          if (rpcError || !rpcResult) {
            // Fallback: direct table query
            const { data: invitation } = await supabase
              .from("invitations")
              .select("*")
              .eq("code", inviteCode.toUpperCase())
              .single();

            if (invitation && invitation.used_count < invitation.max_uses) {
              const notExpired = !invitation.expires_at || new Date(invitation.expires_at) > new Date();
              if (notExpired) {
                await supabase.from("community_members").upsert({
                  community_id: invitation.community_id,
                  user_id: user.id,
                  role: "member",
                  status: "active",
                });

                // Try to increment used count (may fail due to RLS)
                await supabase
                  .from("invitations")
                  .update({ used_count: invitation.used_count + 1 })
                  .eq("id", invitation.id);
              }
            }
          }

          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      // Redirect to app - the app layout will handle missing membership
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
