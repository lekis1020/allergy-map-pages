import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          KAACI_JR
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          같은 업종, 같은 관심사를 가진 전문가들이 모이는
          <br />
          KAACI_JR 비공개 비즈니스 네트워킹입니다.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-input bg-background px-6 py-3 text-sm font-semibold hover:bg-accent transition-colors"
          >
            초대 코드로 가입
          </Link>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3 className="mt-4 font-semibold">토론 &amp; 채팅</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              실시간 채팅과 심층 토론으로 전문 지식을 나눕니다
            </p>
          </div>
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14,2 14,8 20,8"></polyline></svg>
            </div>
            <h3 className="mt-4 font-semibold">자료 공유</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              유용한 자료와 콘텐츠를 안전하게 공유합니다
            </p>
          </div>
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <h3 className="mt-4 font-semibold">문서 협업</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              공유 문서로 함께 작업하고 아이디어를 발전시킵니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
