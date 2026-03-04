-- ============================================
-- STEP 11: 논문 토론 기능 (Paper Discussions)
-- posts 테이블에 pmid 컬럼 추가 + 논문-토론 채널 생성
-- ============================================

-- posts 테이블에 pmid 컬럼 추가 (논문-게시글 연결용)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pmid TEXT;

-- pmid 유니크 인덱스 (NULL 제외)
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_pmid ON posts(pmid) WHERE pmid IS NOT NULL;

-- "논문-토론" 채널 생성
INSERT INTO channels (community_id, name, description, type, is_default, sort_order)
SELECT c.id, '논문-토론', 'PubMed 논문에 대한 토론', 'discussion', false, 10
FROM communities c LIMIT 1
ON CONFLICT DO NOTHING;
