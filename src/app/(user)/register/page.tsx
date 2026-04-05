import { Suspense } from "react";
import RegisterForm from "@/components/features/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="min-h-[calc(100vh-88px)] bg-[#EBEBEB] flex items-center justify-center px-6 py-10">
      <Suspense
        fallback={
          <section className="w-full max-w-md bg-white border border-black/10 p-8">
            <p className="text-sm text-black/60">Memuat form registrasi...</p>
          </section>
        }
      >
        <RegisterForm />
      </Suspense>
    </main>
  );
}
