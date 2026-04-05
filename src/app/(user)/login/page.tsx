import { Suspense } from "react";
import LoginForm from "@/components/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] flex items-center justify-center px-6 py-10">
      <Suspense
        fallback={
          <section className="w-full max-w-md bg-white border border-black/10 p-8">
            <p className="text-sm text-black/60">Memuat login...</p>
          </section>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
