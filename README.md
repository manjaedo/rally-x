# 🏎️ Rally-X (1980 Namco Arcade Web Remake)

> **1980년 남코(Namco)의 전설적인 아케이드 레이싱 게임 '랠리-X(Rally-X)'를 웹 표준 HTML5 Canvas와 Web Audio API로 완벽 재현한 프로젝트**

- 📦 **GitHub 저장소**: [https://github.com/manjaedo/rally-x](https://github.com/manjaedo/rally-x)

---

## ✨ 주요 특징 (Features)
1. **원작 아케이드 감성 재현**: 블루카(플레이어), 레드카(추격 차량 AI), 깃발(Checkpoints), 바위(Rocks) 장애물, 연막(Smoke Screen) 시스템 구현
2. **실시간 레이더(Radar) 미니맵**: 우측 대시보드에 전체 맵의 깃발 위치(노란 점), 스페셜 깃발(`S`), 적 차량(빨간 점), 내 차량(흰/파란 점)을 실시간 표시
3. **연막(Smoke Screen) 액션**: 연료를 소모해 후방에 연막을 분사하여 추격해 오는 레드카를 회전·마비시키는 핵심 메커니즘 구현
4. **Web Audio 신디사이저 사운드**: 별도 외부 음원 파일 없이 순수 Web Audio API로 경쾌한 배경음악, 연막 효과음, 깃발 획득음, 충돌 사운드 구현

---

## 🎮 조작 방법 (Controls)
- **방향 전환**: 방향키 (`↑`, `↓`, `←`, `→`) 또는 `W`, `A`, `S`, `D`
- **연막 발사 (Smoke)**: `Space` 또는 `Z`
- **게임 시작 / 재시작**: `Enter` 또는 화면 버튼 클릭

---

## 📁 파일 구조
- [`index.html`](./index.html) : 게임 화면 및 아케이드 캐비닛 UI 레이아웃
- [`style.css`](./style.css) : 레트로 CRT 아케이드 스타일시트 및 반응형 레이아웃
- [`game.js`](./game.js) : 맵 타일 엔진, 차량 물리/충돌, 레드카 추격 AI, 레이더 렌더링, Web Audio 사운드 엔진
- [`AGENTS.md`](./AGENTS.md) : 프로젝트 코딩 헌법 및 아케이드 보존 규칙
- [`STATUS.md`](./STATUS.md) : 개발 진행 현황판
