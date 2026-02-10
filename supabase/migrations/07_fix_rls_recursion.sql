-- ============================================
-- STEP 7: community_members RLS 무한 재귀 수정
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 헬퍼 함수: 현재 사용자의 활성 커뮤니티 ID 목록 (RLS 우회)
CREATE OR REPLACE FUNCTION public.get_my_community_ids()
RETURNS SETOF UUID AS $$
  SELECT community_id
  FROM community_members
  WHERE user_id = auth.uid() AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 헬퍼 함수: 현재 사용자가 관리자인 커뮤니티 ID 목록 (RLS 우회)
CREATE OR REPLACE FUNCTION public.get_my_admin_community_ids()
RETURNS SETOF UUID AS $$
  SELECT community_id
  FROM community_members
  WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- community_members 정책 수정 (무한 재귀 제거)
DROP POLICY IF EXISTS "Members can view other members" ON community_members;
DROP POLICY IF EXISTS "Admins and owners can manage members" ON community_members;

CREATE POLICY "Members can view other members"
  ON community_members FOR SELECT TO authenticated
  USING (community_id IN (SELECT get_my_community_ids()));

CREATE POLICY "Admins and owners can manage members"
  ON community_members FOR ALL TO authenticated
  USING (community_id IN (SELECT get_my_admin_community_ids()));

-- communities 정책도 수정
DROP POLICY IF EXISTS "Communities are viewable by members" ON communities;
CREATE POLICY "Communities are viewable by members"
  ON communities FOR SELECT TO authenticated
  USING (id IN (SELECT get_my_community_ids()));

-- channels 정책 수정
DROP POLICY IF EXISTS "Channels viewable by community members" ON channels;
DROP POLICY IF EXISTS "Admins can manage channels" ON channels;

CREATE POLICY "Channels viewable by community members"
  ON channels FOR SELECT TO authenticated
  USING (community_id IN (SELECT get_my_community_ids()));

CREATE POLICY "Admins can manage channels"
  ON channels FOR ALL TO authenticated
  USING (community_id IN (SELECT get_my_admin_community_ids()));

-- posts 정책 수정
DROP POLICY IF EXISTS "Posts viewable by community members" ON posts;
DROP POLICY IF EXISTS "Members can create posts" ON posts;
DROP POLICY IF EXISTS "Authors and admins can delete posts" ON posts;

CREATE POLICY "Posts viewable by community members"
  ON posts FOR SELECT TO authenticated
  USING (community_id IN (SELECT get_my_community_ids()));

CREATE POLICY "Members can create posts"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT get_my_community_ids()) AND author_id = auth.uid());

CREATE POLICY "Authors and admins can delete posts"
  ON posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR community_id IN (SELECT get_my_admin_community_ids()));

-- comments 정책 수정
DROP POLICY IF EXISTS "Comments viewable by community members" ON comments;
CREATE POLICY "Comments viewable by community members"
  ON comments FOR SELECT TO authenticated
  USING (post_id IN (
    SELECT p.id FROM posts p
    WHERE p.community_id IN (SELECT get_my_community_ids())
  ));

-- messages 정책 수정
DROP POLICY IF EXISTS "Messages viewable by community members" ON messages;
CREATE POLICY "Messages viewable by community members"
  ON messages FOR SELECT TO authenticated
  USING (channel_id IN (
    SELECT c.id FROM channels c
    WHERE c.community_id IN (SELECT get_my_community_ids())
  ));

-- documents 정책 수정
DROP POLICY IF EXISTS "Documents viewable by community members" ON documents;
DROP POLICY IF EXISTS "Members can create documents" ON documents;
DROP POLICY IF EXISTS "Members can update shared documents" ON documents;

CREATE POLICY "Documents viewable by community members"
  ON documents FOR SELECT TO authenticated
  USING (community_id IN (SELECT get_my_community_ids()));

CREATE POLICY "Members can create documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT get_my_community_ids()) AND author_id = auth.uid());

CREATE POLICY "Members can update shared documents"
  ON documents FOR UPDATE TO authenticated
  USING (community_id IN (SELECT get_my_community_ids()));
