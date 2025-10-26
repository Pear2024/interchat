import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-12 text-slate-50">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-white/5 p-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
