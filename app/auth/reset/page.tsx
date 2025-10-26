'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser-client';

type EmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

const isEmailOtpType = (value: string | null | undefined): value is EmailOtpType =>
  !!value && EMAIL_OTP_TYPES.includes(value as EmailOtpType);

const normalizeEmailOtpType = (value: string | null | undefined): EmailOtpType => {
  if (value === 'reset_password') return 'recovery';
  return isEmailOtpType(value) ? value : 'recovery';
};

export default function ResetPasswordPage() {
  const supabase = getSupabaseBrowserClient();
  const [phase, setPhase] = useState<'checking'|'set'|'done'|'error'>('checking');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // รองรับได้ทั้งลิงก์ที่ส่ง ?code= และ #access_token=
        const currentUrl = new URL(window.location.href);
        const searchParams = currentUrl.searchParams;
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        const code = searchParams.get('code');
        const hashCode = hashParams.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenHash =
          searchParams.get('token_hash') ?? hashParams.get('token_hash');
        const email =
          searchParams.get('email') ?? hashParams.get('email');
        const type = hashParams.get('type') ?? searchParams.get('type');
        const errorDescription =
          hashParams.get('error_description') ??
          searchParams.get('error_description');

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        let sessionEstablished = false;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          sessionEstablished = true;
        }

        if (!sessionEstablished && hashCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(hashCode);
          if (error) throw error;
          sessionEstablished = true;
        }

        if (!sessionEstablished && tokenHash) {
          if (!email) {
            throw new Error('Reset link missing email parameter required for token hash verification.');
          }

          const otpType = normalizeEmailOtpType(type);
          const { data, error } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
            email,
          });
          if (error) throw error;

          const access_token = data.session?.access_token;
          const refresh_token = data.session?.refresh_token;
          if (access_token && refresh_token) {
            const { error: setError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (setError) throw setError;
            sessionEstablished = true;
          } else if (data.session) {
            throw new Error('Reset link verified but no session tokens returned.');
          }
        }

        if (!sessionEstablished && (accessToken || refreshToken)) {
          if (accessToken && refreshToken) {
            // เซ็ต session เองกรณีลิงก์ recovery เก่าที่ Supabase ส่ง token ไว้หลัง hash
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            sessionEstablished = true;
          } else {
            throw new Error('Reset link is missing required tokens.');
          }
        }

        if (sessionEstablished && hash) {
          // ล้าง hash จาก URL เพื่อลดการก๊อปปี้ token ผิดพลาด
          const cleanUrl = `${currentUrl.origin}${currentUrl.pathname}${currentUrl.search}`;
          window.history.replaceState(window.history.state, document.title, cleanUrl);
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        if (cancelled) return;

        if (user) {
          setPhase('set');
        } else {
          // ถ้าไม่มี session แต่ลิงก์บอกว่าเป็น recovery แสดง error ชัดเจน
          if (type === 'recovery') {
            setMsg((current) => current ?? 'Auth session missing from reset link.');
          }
          setPhase('error');
        }
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : null;
        setMsg(message);
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const submit = async () => {
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setMsg(error.message); return; }
    setPhase('done');
  };

  if (phase === 'checking') return <p style={{padding:24}}>Verifying reset link…</p>;
  if (phase === 'error') return <p style={{padding:24,color:'crimson'}}>
    Invalid or expired link. Please request password reset again. {msg ? `(${msg})` : ''}
  </p>;
  if (phase === 'done') return <p style={{padding:24}}>Password updated ✅ You can now sign in.</p>;

  return (
    <div style={{padding:24, maxWidth:420}}>
      <h1>Set a new password</h1>
      <input
        type="password"
        placeholder="New password"
        value={pw}
        onChange={(e)=>setPw(e.target.value)}
        style={{width:'100%',padding:12,marginTop:12}}
      />
      <button onClick={submit} style={{marginTop:12,padding:'10px 16px'}}>Update password</button>
      {msg && <p style={{color:'crimson'}}>{msg}</p>}
    </div>
  );
}
