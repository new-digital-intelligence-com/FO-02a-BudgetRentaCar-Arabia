import type { Metadata } from "next";
import { safeNextPath, sitePasswordConfigured } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in – Budget Voice Assistant Demo",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);

  return (
    <main className="flex flex-1 items-center justify-center bg-budget-navy px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-budget-orange" dir="ltr">
            Budget
          </span>
          <span className="font-semibold text-budget-navy">المساعدة الصوتية</span>
        </div>
        <p className="mt-2 text-xs text-budget-muted">
          نسخة تجريبية من NDI · ليست موقعاً رسمياً لـ Budget
          <br />
          <span dir="ltr">NDI demo · not an official Budget website</span>
        </p>
        {sitePasswordConfigured() ? (
          <LoginForm nextPath={nextPath} />
        ) : (
          <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-budget-red-dark" dir="ltr">
            This demo is locked: the SITE_PASSWORD environment variable is not set.
          </p>
        )}
      </div>
    </main>
  );
}
