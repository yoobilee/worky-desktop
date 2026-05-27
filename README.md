# WORKY mini — 거래처 관리 데스크탑 런처

Worky 웹과 연동되는 Windows 데스크탑 앱입니다.  
거래처별 카카오톡 채팅방을 빠르게 열고, 보고 메시지를 클립보드에 복사해 업무 플로우를 간소화합니다.

> **WORKY mini는 [Worky 웹](https://worky-alpha.vercel.app)과 함께 사용하는 앱입니다.**

---

## 다운로드

[→ 최신 릴리즈 다운로드](https://github.com/yoobilee/worky-desktop/releases)

`WORKY mini Setup x.x.x.exe` 파일을 다운로드 후 실행하여 설치하세요.

**요구사항**
- Windows 10 / 11
- 카카오톡 설치 필요

---

## 기술 스택

**Frontend**  
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

**빌드**  
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

**인증 / DB**  
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth-4285F4?style=flat-square&logo=google&logoColor=white)

**플랫폼**  
![Windows](https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white)

---

## 주요 기능

### 거래처 목록
- Worky 웹의 거래처 데이터를 실시간으로 동기화 (Supabase Realtime)
- 검색, 정렬 (진행 중 우선 / 대기 중 우선 / 만료 임박순 / 거래처명순)
- 거래처 그룹핑 (설정에서 on/off)

### 카카오톡 채팅방 빠른 열기
- 거래처 카드에 카카오톡 채팅방 이름 등록
- 버튼 클릭 시 해당 채팅방을 최상단으로 즉시 활성화
- 한글·이모지 채팅방 이름 지원

### 보고 메시지 복사
- 거래처별 보고 메시지 템플릿 등록
- 복사 버튼 클릭 시 클립보드 자동 복사 → 카카오톡에서 Ctrl+V

### 최근 열기 목록
- 최근에 열었던 채팅방 빠른 접근 (설정에서 on/off, 개수 조정 가능)

### 기타
- 최상단 고정 핀 (항상 위에 표시)
- 창 가장자리 자석 기능 (화면 끝에 자동 부착)
- 카카오톡 자동 실행 (앱 시작 시 카톡이 꺼져있으면 자동 실행)
- 라이트 / 다크 / 시스템 테마 지원
- Google 계정으로 로그인

---

## 개발 환경 실행

```bash
# 1. 저장소 클론
git clone https://github.com/yoobilee/worky-desktop.git
cd worky-desktop

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env에 Supabase URL, Anon Key 입력

# 4. 개발 서버 실행
npm run dev
```

---

## 빌드

```bash
npm run build
```

`release/` 폴더에 설치파일(`.exe`)이 생성됩니다.

---

## 환경변수

`.env` 파일에 아래 변수를 설정하세요.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 주의사항

- 현재 Google OAuth 테스트 모드로 운영 중입니다. 등록된 계정만 로그인 가능합니다.
- 카카오톡 채널 채팅은 지원하지 않습니다 (1:1, 단체, 오픈채팅방만 지원).
- Windows 전용 앱입니다.

---

## 라이선스

Copyright © 2026 yoobilee. All Rights Reserved.