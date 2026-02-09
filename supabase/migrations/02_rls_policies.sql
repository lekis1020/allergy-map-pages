-- ============================================
-- STEP 2: RLS 정책 설정
-- STEP 1 실행 후에 이것을 실행하세요
-- ============================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- communities
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Communities are viewable by members"
  ON communities FOR SELECT TO authenticated
  USING (id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active'));

-- community_members
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view other members"
  ON community_members FOR SELECT TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members cm WHERE cm.user_id = auth.uid() AND cm.status = 'active'));
CREATE POLICY "Admins and owners can manage members"
  ON community_members FOR ALL TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin') AND cm.status = 'active'));
CREATE POLICY "Users can insert their own membership"
  ON community_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invitations viewable by admins"
  ON invitations FOR SELECT TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'));
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'));
CREATE POLICY "Anyone can read invitation by code for signup"
  ON invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'));

-- channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels viewable by community members"
  ON channels FOR SELECT TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Admins can manage channels"
  ON channels FOR ALL TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'));

-- posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by community members"
  ON posts FOR SELECT TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Members can create posts"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active') AND author_id = auth.uid());
CREATE POLICY "Authors can update own posts"
  ON posts FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "Authors and admins can delete posts"
  ON posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'));

-- comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by community members"
  ON comments FOR SELECT TO authenticated
  USING (post_id IN (SELECT p.id FROM posts p JOIN community_members cm ON cm.community_id = p.community_id WHERE cm.user_id = auth.uid() AND cm.status = 'active'));
CREATE POLICY "Members can create comments"
  ON comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own comments"
  ON comments FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "Authors can delete own comments"
  ON comments FOR DELETE TO authenticated USING (author_id = auth.uid());

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by community members"
  ON messages FOR SELECT TO authenticated
  USING (channel_id IN (SELECT c.id FROM channels c JOIN community_members cm ON cm.community_id = c.community_id WHERE cm.user_id = auth.uid() AND cm.status = 'active'));
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Documents viewable by community members"
  ON documents FOR SELECT TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Members can create documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active') AND author_id = auth.uid());
CREATE POLICY "Members can update shared documents"
  ON documents FOR UPDATE TO authenticated
  USING (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid() AND status = 'active'));

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT TO authenticated WITH CHECK (true);
