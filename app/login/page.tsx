import { LoginForm } from "./login-form";

export const metadata = { title: "로그인 · Personal OS" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text">Personal OS</h1>
        <p className="mt-1 mb-5 text-sm text-text-muted">
          등록된 이메일로 로그인 링크를 보냅니다. 비밀번호는 쓰지 않습니다.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
