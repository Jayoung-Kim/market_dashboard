# 시황 대시보드

코스피·코스닥, 나스닥·S&P 500 등 해외 지수, 주요 ETF, 금·은·유가, 금리·환율을 한 화면에서 보는 대시보드입니다. 관심종목을 추가할 수 있고 1분마다 자동으로 갱신돼요.

## 데이터 출처
- Yahoo Finance 비공식 차트 API (API 키 불필요)
- 미국 주식·ETF는 거의 실시간이고, 한국 시장은 약 20분, 선물(금·은·유가)은 10~15분 늦을 수 있어요.
- 투자 판단의 근거로 사용하지 마세요.

## 구조
```
public/index.html   화면 (정적 파일)
api/batch.js        여러 종목의 시세와 차트 데이터 (Vercel 서버리스 함수)
api/search.js       종목 검색
lib/yahoo.js        Yahoo 호출과 짧은 캐시
public/krx.json     한국 상장 종목 목록 (한글 이름 검색용)
scripts/update_krx.py  KRX KIND에서 종목 목록을 받아 krx.json 갱신
vercel.json         public 폴더를 사이트 루트로 지정
```
브라우저가 Yahoo를 직접 호출하면 CORS 정책에 막히기 때문에, `/api` 함수가 대신 데이터를 받아 전달합니다. 응답은 Vercel CDN에 30초 캐시돼서 방문자가 많아도 Yahoo 호출이 크게 늘지 않아요.

## 배포
1. Vercel에서 **Add New → Project**를 누르고 이 저장소를 Import 합니다.
2. Framework Preset은 **Other** 그대로 두고 Deploy를 누릅니다. 환경 변수는 필요 없어요.

## 한국 종목 검색
관심종목 검색창에서 한글 이름(삼성전자), 일부 이름(하이닉스), 초성(ㅅㅅㅈㅈ), 6자리 코드(005930)로 찾을 수 있어요. 종목 목록은 GitHub Actions(`한국 종목 목록 갱신`)가 매주 월요일 아침 KRX KIND에서 받아 갱신하고, Actions 탭에서 직접 실행할 수도 있어요.

## 기본 종목 바꾸기
`public/index.html`의 `GROUPS` 목록에서 `['티커','표시 이름']`을 추가하거나 지우면 됩니다. 한국 종목은 `005930.KS`(코스피), `247540.KQ`(코스닥) 형식이에요.

## 로컬에서 실행
```
npm i -g vercel
vercel dev
```
