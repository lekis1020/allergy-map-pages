# KAAACI Map

대한천식알레르기학회 병원 검색 데이터를 기반으로 알레르기 전문 진료 병원을 지도에서 탐색하는 정적 웹 서비스입니다.

- Repository: `lekis1020/kaaaci-map`
- Production URL: `https://lekis1020.github.io/kaaaci-map/`

## 주요 기능

- 지역/진료과/키워드 기반 병원 검색
- 지도 + 리스트 동시 탐색
- Jext/Firazyr 처방 가능 병원 필터
- 다크 모드 (시스템 설정 연동)
- PWA 지원 (홈 화면 설치, standalone 실행)
- GitHub Pages 자동 배포

## 기술 스택

- **Next.js 16** (App Router, 정적 export `output: "export"`)
- **React 19** · **TypeScript**
- **Tailwind CSS v4**
- **Leaflet** + OpenStreetMap 타일 (지도 렌더링)

> 정적 사이트(static export)이므로 별도 서버·백엔드·API 키가 없으며, 병원 데이터는 빌드 시 번들에 포함됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

기본 접속: `http://localhost:3000`

## 빌드/검증

```bash
npm run lint
NEXT_PUBLIC_BASE_PATH=/kaaaci-map npm run build
```

정적 export 모드라 `npm run start`는 사용하지 않습니다. 빌드 결과(`out/`)를 로컬에서 미리 보려면:

```bash
npx serve out
```

> `basePath`로 빌드했다면 `http://localhost:3000/kaaaci-map/` 경로로 접속하세요.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 정적 빌드(`out/`) 후 GitHub Pages로 자동 배포합니다.

- workflow: `.github/workflows/deploy-pages.yml`
- 배포 시 `NEXT_PUBLIC_BASE_PATH`는 저장소명(`/kaaaci-map`)으로 자동 주입됩니다.
- 권한은 `contents: read`, `pages: write`, `id-token: write`(OIDC)로 최소화되어 있으며 별도 시크릿을 사용하지 않습니다.
- Pages URL 형식: `https://<username>.github.io/<repo>/`

## 데이터 소스 및 동기화 기준

- 원천: `https://www.allergy.or.kr/general/hospitalSearch`
- 실제 데이터 엔드포인트: `https://www.allergy.or.kr/general/data`
- 동기화 원칙: 온라인(학회) 데이터를 truth source로 간주

현재 리포지토리 데이터 파일:

- `data/allergy-hospitals.json`

## 데이터 스키마

각 병원 항목은 아래 필드를 포함합니다.

- `name`: 병원명
- `region`: 시/도
- `district`: 구/군/시
- `address`: 주소
- `depts`: 진료과 목록
- `doctors`: 진료과별 의료진 목록
- `tel`: 대표 전화
- `lat`, `lng`: 지도 좌표
- `jext`: Jext 처방 가능 여부
- `firazyr`: Firazyr 처방 가능 여부

## 디렉터리 구조

```text
app/
├── layout.tsx        # 루트 레이아웃 · 메타데이터 · 테마(다크 모드) 초기화
├── page.tsx          # 진입 페이지
├── map-content.tsx   # 지도 + 검색/필터 UI (Leaflet)
└── globals.css       # 전역 스타일 (Tailwind)
data/
└── allergy-hospitals.json   # 병원 데이터
public/
├── manifest.json     # PWA 매니페스트
└── icons/            # PWA 아이콘 (192/512)
.github/workflows/
└── deploy-pages.yml  # GitHub Pages 배포 파이프라인
```
