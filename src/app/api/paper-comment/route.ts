import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. 사용자 인증
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 요청 바디 파싱
  const { pmid, paperTitle, comment } = await request.json();
  if (!pmid || !comment?.trim()) {
    return NextResponse.json(
      { error: "pmid and comment are required" },
      { status: 400 }
    );
  }

  // 3. 사용자의 커뮤니티 확인
  const { data: membership } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a community member" },
      { status: 403 }
    );
  }

  const communityId = membership.community_id;

  // 4. "논문-토론" 채널 조회
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("community_id", communityId)
    .eq("name", "논문-토론")
    .single();

  if (!channel) {
    return NextResponse.json(
      { error: "Paper discussion channel not found" },
      { status: 404 }
    );
  }

  // 5. pmid로 기존 post 조회, 없으면 생성
  let postId: string;

  const { data: existingPost } = await supabase
    .from("posts")
    .select("id")
    .eq("pmid", pmid)
    .maybeSingle();

  if (existingPost) {
    postId = existingPost.id;
  } else {
    const { data: newPost, error: postError } = await supabase
      .from("posts")
      .insert({
        channel_id: channel.id,
        community_id: communityId,
        author_id: user.id,
        title: paperTitle || `PMID: ${pmid}`,
        content: `PubMed 논문 토론\nhttps://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        content_type: "text" as const,
        pmid,
      })
      .select("id")
      .single();

    if (postError) {
      // 동시성 처리: unique index 위반 시 재조회
      if (postError.code === "23505") {
        const { data: retryPost } = await supabase
          .from("posts")
          .select("id")
          .eq("pmid", pmid)
          .single();
        if (!retryPost) {
          return NextResponse.json(
            { error: "Failed to find or create post" },
            { status: 500 }
          );
        }
        postId = retryPost.id;
      } else {
        return NextResponse.json(
          { error: postError.message },
          { status: 500 }
        );
      }
    } else {
      postId = newPost.id;
    }
  }

  // 6. 댓글 삽입
  const { data: newComment, error: commentError } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      content: comment.trim(),
    })
    .select("id")
    .single();

  if (commentError) {
    return NextResponse.json(
      { error: commentError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    postId,
    commentId: newComment.id,
    channelId: channel.id,
  });
}
