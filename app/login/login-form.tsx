"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type SignInResult } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInResult | null, FormData>(sendMagicLink, null);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="email" className="block text-sm font-medium text-text">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted"
      />
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "보내는 중" : "로그인 링크 받기"}
      </Button>

      {state && (
        <p
          role="status"
          className={state.ok ? "text-sm text-positive" : "text-sm text-negative"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
