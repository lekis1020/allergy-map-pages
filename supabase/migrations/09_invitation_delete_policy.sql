-- ============================================
-- STEP 9: invitations 테이블 DELETE RLS 정책 추가
-- 관리자/소유자가 초대코드를 삭제할 수 있도록 허용
-- ============================================

CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE TO authenticated
  USING (community_id IN (SELECT get_my_admin_community_ids()));
