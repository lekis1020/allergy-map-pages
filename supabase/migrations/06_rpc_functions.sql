-- ============================================
-- STEP 6: RPC 함수 생성
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 초대 코드로 커뮤니티 참여 (RLS 우회)
CREATE OR REPLACE FUNCTION public.use_invite_code(p_invite_code TEXT, p_for_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_inv_id UUID;
  v_inv_community_id UUID;
  v_inv_used_count INT;
BEGIN
  SELECT id, community_id, used_count
  INTO v_inv_id, v_inv_community_id, v_inv_used_count
  FROM invitations
  WHERE code = upper(p_invite_code)
    AND used_count < max_uses
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE invitations
  SET used_count = v_inv_used_count + 1
  WHERE id = v_inv_id;

  INSERT INTO community_members (community_id, user_id, role, status)
  VALUES (v_inv_community_id, p_for_user_id, 'member', 'active')
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 초대 코드 유효성 검증
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_invite_code TEXT)
RETURNS TABLE (community_id UUID, is_valid BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.community_id,
    (i.used_count < i.max_uses AND (i.expires_at IS NULL OR i.expires_at > now())) AS is_valid
  FROM invitations i
  WHERE i.code = upper(p_invite_code)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
