# KAAACI Allergy Map (Standalone Service)

`allergy_community` 안에 있던 알레르기 전문 진료 병원 지도 기능을 독립 실행 가능한 서비스로 분리한 앱입니다.

## 1) 로컬 실행

```bash
cd services/allergy-map-standalone
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 2) 운영 배포

이 폴더를 단독 서비스로 배포할 때는 배포 플랫폼의 프로젝트 루트를
`services/allergy-map-standalone` 로 지정하면 됩니다.

- Vercel: Root Directory 지정 후 기본 Next.js 빌드 사용
- Netlify: Base directory 지정 후 Build command `npm run build`, Publish `.next`

## 3) 데이터 업데이트

병원 데이터는 `data/allergy-hospitals.json` 파일을 사용합니다.
원본 커뮤니티 서비스의 데이터를 반영할 때는 해당 파일을 동기화해서 배포하세요.
