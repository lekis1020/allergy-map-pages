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
      // If there's an invite code, process it
      if (inviteCode) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Find the invitation
          const { data: invitation } = await supabase
            .from("invitations")
            .select("*")
            .eq("code", inviteCode.toUpperCase())
            .single();

          if (invitation && invitation.used_count < invitation.max_uses) {
            // Add user as community member
            await supabase.from("community_members").upsert({
              community_id: invitation.community_id,
              user_id: user.id,
              role: "member",
              status: "active",
            });

            // Increment used count
            await supabase
              .from("invitations")
              .update({ used_count: invitation.used_count + 1 })
              .eq("id", invitation.id);
          }
        }

        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // Check if user has profile completed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company, role_title")
          .eq("id", user.id)
          .single();

        // If profile incomplete, redirect to onboarding
        if (profile && !profile.company && !profile.role_title) {
          // Check if user has any community membership
          const { data: membership } = await supabase
            .from("community_members")
            .select("community_id")
            .eq("user_id", user.id)
            .eq("status", "active")
            .limit(1)
            .single();

          if (!membership) {
            return NextResponse.redirect(`${origin}/onboarding`);
          }
        }
      }

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
