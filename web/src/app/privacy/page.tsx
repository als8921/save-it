import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | save-it",
  description: "save-it의 개인정보 수집·이용·보관 정책",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 leading-relaxed text-sm">
      <h1 className="text-xl font-bold">개인정보 처리방침</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        최종 업데이트: 2026-05-27
      </p>

      <p className="mt-6">
        save-it(이하 “서비스”)은 사용자의 개인정보를 소중히 다루며, 다음과
        같이 수집·이용·보관합니다. 본 처리방침은 서비스 웹앱과 브라우저
        익스텐션 모두에 동일하게 적용됩니다.
      </p>

      <h2 className="mt-8 text-base font-semibold">1. 수집하는 정보</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>계정 정보</strong>: 이메일 주소(회원가입·로그인용)
        </li>
        <li>
          <strong>사용자 저장 데이터</strong>: 사용자가 직접 저장한 링크
          URL·제목·설명·우선도, 폴더 이름과 분류(PARA)
        </li>
        <li>
          <strong>리마인드 설정</strong>: 일일 알림 활성 여부, 알림 시각,
          시간대 등 사용자가 직접 입력한 환경설정
        </li>
        <li>
          <strong>푸시 구독 정보</strong>(사용자가 알림을 켠 경우에 한함):
          브라우저가 발급한 push endpoint URL과 암호화 키 두 개(p256dh, auth).
          이 값은 알림을 보내는 데에만 사용됩니다.
        </li>
        <li>
          <strong>이용 기록</strong>: 추천된 링크의 발송 시각과 클릭 시각/횟수
          (서비스 품질 개선과 “이미 본 링크는 다시 추천하지 않기” 처리를 위함)
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">2. 이용 목적</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>로그인 세션 유지 및 본인 데이터 표시</li>
        <li>저장한 링크의 검색·열람·정리 기능 제공</li>
        <li>
          “오늘 다시 볼 링크” 추천과 푸시 알림 발송(사용자가 동의한 경우에 한함)
        </li>
        <li>서비스 품질 개선과 오류 분석</li>
      </ul>
      <p className="mt-2">
        수집한 정보를 광고·마케팅 목적으로 사용하지 않으며, 별도 동의 없이
        제3자에게 판매·공유하지 않습니다.
      </p>

      <h2 className="mt-8 text-base font-semibold">3. 보관 기간</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          회원 정보 및 저장 데이터: 회원 탈퇴 시까지. 탈퇴 즉시 모든 개인정보와
          사용자 데이터가 데이터베이스에서 영구 삭제됩니다.
        </li>
        <li>
          푸시 구독 정보: 사용자가 알림을 끄거나 endpoint가 만료(브라우저
          측에서 폐기)되면 즉시 삭제됩니다.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">4. 처리 위탁</h2>
      <p className="mt-2">
        서비스 운영을 위해 다음 신뢰할 수 있는 제3자에게 데이터 저장·전송을
        위탁합니다.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>Supabase</strong>: 데이터베이스(PostgreSQL)와 사용자 인증을
          위탁합니다. 모든 사용자 데이터는 Supabase의 Row-Level Security로
          본인 데이터만 접근 가능하도록 격리됩니다.
        </li>
        <li>
          <strong>Vercel</strong>: 웹앱 호스팅 및 서버리스 실행 환경을
          위탁합니다.
        </li>
        <li>
          <strong>Web Push 서비스 제공자</strong>(Apple, Google, Mozilla 등):
          사용자가 알림을 켠 경우, 브라우저가 지정한 push service를 통해
          알림이 전달됩니다. 알림 본문(예: “오늘 다시 볼 링크 N개가 있어요”)
          외의 개인정보는 전달하지 않습니다.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">5. 쿠키와 트래커</h2>
      <p className="mt-2">
        로그인 세션 유지를 위한 Supabase 인증 쿠키만 사용합니다. 광고·분석
        목적의 제3자 추적 도구를 사용하지 않습니다.
      </p>

      <h2 className="mt-8 text-base font-semibold">6. 브라우저 익스텐션의 권한</h2>
      <p className="mt-2">
        익스텐션은 다음 권한만 사용하며, 페이지의 본문이나 입력값을 수집하지
        않습니다.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <code>storage</code>: 사용자가 띄운 위젯의 위치/열림 상태를 브라우저
          로컬에 저장
        </li>
        <li>
          <code>activeTab</code>: 사용자가 익스텐션 아이콘을 눌렀을 때, 그
          시점의 활성 탭 URL과 제목만 1회 읽어 “저장” 입력 폼에 채워줌
        </li>
        <li>
          호스트 권한(<code>save-it.vercel.app</code>,{" "}
          <code>*.supabase.co</code>): 본 서비스 백엔드와의 통신용
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">7. 사용자 권리</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>본인 데이터의 조회·수정·삭제는 앱 안에서 직접 수행할 수 있습니다.</li>
        <li>
          푸시 알림은 설정 페이지에서 언제든 끌 수 있으며, 끄는 즉시 구독
          정보가 서버에서 삭제됩니다.
        </li>
        <li>
          계정 삭제(탈퇴)는 아래 연락처로 요청하시면 7일 이내에 처리합니다.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">8. 보안</h2>
      <p className="mt-2">
        모든 통신은 HTTPS로 전송되며, Supabase의 Row-Level Security로
        사용자별 데이터가 데이터베이스 수준에서 격리됩니다. 비밀번호는 직접
        저장하지 않으며 Supabase Auth가 안전하게 관리합니다.
      </p>

      <h2 className="mt-8 text-base font-semibold">9. 변경 고지</h2>
      <p className="mt-2">
        본 처리방침이 변경될 경우, 변경 사항을 본 페이지에 게시합니다.
        중요한 변경은 가입 이메일로 추가 안내드립니다.
      </p>

      <h2 className="mt-8 text-base font-semibold">10. 연락처</h2>
      <p className="mt-2">
        개인정보 관련 문의·요청은 다음으로 연락해 주세요.
        <br />
        이메일:{" "}
        <a
          href="mailto:aipro2510@gmail.com"
          className="underline underline-offset-2"
        >
          aipro2510@gmail.com
        </a>
      </p>
    </main>
  );
}
