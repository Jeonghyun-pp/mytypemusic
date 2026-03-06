"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/studio");
      } else {
        setError("비밀번호가 틀렸습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0a",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#18181b",
          borderRadius: "16px",
          padding: "40px",
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          border: "1px solid #27272a",
        }}
      >
        <h1 style={{
          margin: 0,
          fontSize: "20px",
          fontWeight: 600,
          color: "#fafafa",
          textAlign: "center",
        }}>
          Web Magazine Studio
        </h1>

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid #3f3f46",
            background: "#09090b",
            color: "#fafafa",
            fontSize: "14px",
            outline: "none",
          }}
        />

        {error && (
          <p style={{ margin: 0, color: "#ef4444", fontSize: "13px", textAlign: "center" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: loading || !password ? "#27272a" : "#3DA66E",
            color: loading || !password ? "#71717a" : "#fff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading || !password ? "default" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
