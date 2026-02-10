-- ============================================
-- STEP 5: 보안 강화 패치
-- 기존 마이그레이션 실행 후에 이것을 실행하세요
-- ============================================

-- 1. 초대코드 정책 수정: 누구나 모든 초대코드를 볼 수 있는 정책 제거
DROP POLICY IF EXISTS "Anyone can read invitation by code for signup" ON invitations;

-- 인증 안 된 사용자도 코드 검증 가능하도록 anon 역할 추가
-- 단, 특정 코드로만 조회 가능하게 제한 (RPC 함수 사용)
CREATE OR REPLACE FUNCTION public.validate_invite_code(invite_code TEXT)
RETURNS TABLE (community_id UUID, is_valid BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.community_id,
    (i.used_count < i.max_uses AND (i.expires_at IS NULL OR i.expires_at > now())) AS is_valid
  FROM invitations i
  WHERE i.code = upper(invite_code)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 알림 생성 정책 수정: 아무나 알림 생성 불가 → 본인에게만 생성 가능
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "Users can create own notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. 초대코드 사용 시 카운트 업데이트 허용 (멤버용)
-- 기존 UPDATE 정책은 admin만 가능 → 일반 사용자도 used_count만 업데이트 가능하도록
CREATE POLICY "Authenticated users can increment invitation used_count"
  ON invitations FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
-- Note: 실제 업데이트 내용 제한은 앱 레벨에서 처리

-- 4. messages에 community 기반 INSERT 검증 추가
DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND channel_id IN (
      SELECT c.id FROM channels c
      JOIN community_members cm ON cm.community_id = c.community_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- 5. comments에 community 기반 INSERT 검증 추가
DROP POLICY IF EXISTS "Members can create comments" ON comments;
CREATE POLICY "Members can create comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND post_id IN (
      SELECT p.id FROM posts p
      JOIN community_members cm ON cm.community_id = p.community_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );
