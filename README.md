# 노래책

인터넷 방송인용 노래 목록 사이트. 서버 없이 정적 파일만으로 동작합니다.

## 파일 구성

- `index.html`, `script.js` — 시청자가 보는 검색/목록 페이지
- `admin.html`, `admin.js` — 곡 추가/수정/삭제하는 관리자 페이지
- `songs.json` — 실제 사이트에 표시되는 곡 목록 데이터
- `style.css` — 공통 스타일

## 로컬에서 미리보기

`songs.json`을 `fetch`로 불러오기 때문에 파일을 더블클릭해서 열면(file://) 브라우저 보안 정책으로 목록이 안 보일 수 있습니다. 로컬 서버로 열어주세요.

```
npx serve .
```

또는

```
python -m http.server 8000
```

## GitHub Pages로 배포하기

1. 이 폴더를 GitHub 저장소로 올립니다.
2. 저장소 Settings → Pages → Source에서 배포할 브랜치(예: main)와 루트 폴더(`/`)를 선택합니다.
3. 몇 분 후 `https://<사용자명>.github.io/<저장소명>/`에서 사이트가 열립니다.

## 곡 추가/수정하기 (관리자)

`admin.html`은 비밀번호로 잠겨 있지만, 코드가 브라우저에 그대로 노출되므로 **진짜 보안이 아닙니다** — 시청자가 마음대로 수정하지 못하게 막는 정도로만 생각해주세요.

1. `admin.js` 맨 위의 `ADMIN_PASSWORD` 값을 원하는 비밀번호로 바꿔주세요.
2. `admin.html`에 접속해 비밀번호를 입력합니다.

### GitHub 연동 설정 (한 번만 하면 됨)

곡을 저장하면 바로 사이트에 반영되도록, GitHub 저장소에 쓰기 권한이 있는 토큰을 발급받아 연결합니다.

1. GitHub에서 [Fine-grained personal access token 발급 페이지](https://github.com/settings/personal-access-tokens/new)로 이동합니다.
2. **Repository access**에서 "Only select repositories"를 고르고 이 노래책 저장소만 선택합니다.
3. **Permissions → Repository permissions → Contents**를 "Read and write"로 설정합니다. (다른 권한은 필요 없습니다)
4. 토큰을 생성하고 복사해둡니다. (이 화면을 벗어나면 다시 볼 수 없으니 꼭 복사)
5. `admin.html`의 "GitHub 연동 설정"을 펼쳐서 계정명, 저장소 이름, 브랜치(기본 `main`), 토큰을 입력하고 "설정 저장"을 누릅니다.
   - 이 정보는 지금 사용 중인 브라우저에만 저장됩니다. 토큰은 곧 이 사이트의 저장소를 수정할 수 있는 비밀번호와 같으니, 공용 컴퓨터에서는 입력하지 마세요.

### 곡 편집하기

1. 곡을 추가/수정/삭제합니다. 편집 내용은 편집하는 즉시 이 브라우저에(localStorage) 임시 저장됩니다.
2. 다 편집했으면 **"GitHub에 저장"** 버튼을 누르면 곧바로 저장소의 `songs.json`이 갱신되고, 잠시 후 실제 사이트에 반영됩니다.

GitHub 연동을 설정하지 않았거나 다른 컴퓨터에서 파일로 옮기고 싶다면, **"JSON 내보내기"**로 파일을 받아 저장소의 `songs.json`을 직접 덮어써서 커밋/푸시해도 됩니다. **"JSON 불러오기"**로는 그 파일을 다시 불러와 이어서 편집할 수 있습니다.
