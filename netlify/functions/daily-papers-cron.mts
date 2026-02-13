import type { Config } from "@netlify/functions";

// 매일 23:55 KST (14:55 UTC) 에 실행
export const config: Config = {
  schedule: "55 14 * * *",
};

export default async () => {
  // 배포된 사이트의 cron API 엔드포인트 호출
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "";
  if (!siteUrl) {
    console.error("No site URL available");
    return new Response("No site URL", { status: 500 });
  }

  const cronSecret = process.env.CRON_SECRET || "";
  const url = `${siteUrl}/api/cron/daily-papers${cronSecret ? `?secret=${cronSecret}` : ""}`;

  console.log(`[daily-papers-cron] Calling: ${url}`);

  try {
    const res = await fetch(url, { method: "GET" });
    const body = await res.text();
    console.log(`[daily-papers-cron] Response ${res.status}: ${body}`);
    return new Response(body, { status: res.status });
  } catch (err) {
    console.error("[daily-papers-cron] Error:", err);
    return new Response(String(err), { status: 500 });
  }
};
