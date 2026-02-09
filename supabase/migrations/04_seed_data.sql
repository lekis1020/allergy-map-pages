-- ============================================
-- STEP 4: 초기 데이터 생성 (시드)
--
-- ⚠️ 먼저 이메일로 회원가입을 한 번 한 뒤에 실행하세요!
-- 가입하면 profiles 테이블에 자동으로 사용자가 추가됩니다.
--
-- 아래 'YOUR_USER_ID' 부분을 실제 사용자 UUID로 바꿔야 합니다.
-- Supabase 대시보드 > Authentication > Users에서 확인 가능합니다.
-- ============================================

-- ▼▼▼ 여기에 본인 UUID를 넣으세요 ▼▼▼
DO $$
DECLARE
  v_user_id UUID := 'YOUR_USER_ID';  -- ← 실제 UUID로 교체!
  v_community_id UUID;
BEGIN

  -- 커뮤니티 생성
  INSERT INTO communities (name, description, owner_id)
  VALUES ('우리 커뮤니티', '같은 업종/직군 전문가들의 비공개 네트워킹 커뮤니티', v_user_id)
  RETURNING id INTO v_community_id;

  -- 운영자(owner)로 멤버 등록
  INSERT INTO community_members (community_id, user_id, role, status)
  VALUES (v_community_id, v_user_id, 'owner', 'active');

  -- 기본 채널 생성
  INSERT INTO channels (community_id, name, description, type, is_default, sort_order) VALUES
    (v_community_id, '일반-토론', '자유로운 토론 공간입니다', 'discussion', true, 0),
    (v_community_id, '실시간-채팅', '가벼운 대화를 나눠보세요', 'chat', false, 1),
    (v_community_id, '자료-공유', '유용한 자료를 공유합니다', 'resource', false, 2),
    (v_community_id, '공동-작업', '협업 문서와 프로젝트', 'collaboration', false, 3),
    (v_community_id, '공지사항', '운영자 공지', 'discussion', false, 4);

  -- 테스트용 초대 코드 생성 (10회 사용 가능, 30일 유효)
  INSERT INTO invitations (community_id, code, invited_by, max_uses, expires_at)
  VALUES (v_community_id, 'WELCOME1', v_user_id, 10, now() + interval '30 days');

  RAISE NOTICE '✅ 커뮤니티 생성 완료! ID: %', v_community_id;
  RAISE NOTICE '✅ 초대코드: WELCOME1 (10회, 30일)';

END $$;
