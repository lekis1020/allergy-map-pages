-- ============================================
-- STEP 10: attachments 버킷을 public으로 변경
-- private 버킷에서 getPublicUrl()로 생성된 URL은
-- 접근이 차단되어 이미지 조회/다운로드가 불가능했음
-- ============================================

UPDATE storage.buckets SET public = true WHERE id = 'attachments';
