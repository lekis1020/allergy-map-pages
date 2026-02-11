"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

/**
 * Detects iOS Safari (not standalone) and shows an "Add to Home Screen" prompt
 * so the user can launch the app without Safari browser chrome.
 */
export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari when NOT already in standalone mode
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) {
      // Check if user already dismissed
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        // Show after a short delay so it doesn't flash immediately
        const timer = setTimeout(() => setShow(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 safe-bottom">
      <div className="mx-4 mb-4 rounded-xl bg-card border shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              홈 화면에 추가하기
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Safari 하단의{" "}
              <Share className="inline h-3.5 w-3.5 -mt-0.5" />{" "}
              공유 버튼을 누른 후 &quot;홈 화면에 추가&quot;를 선택하면
              앱처럼 전체 화면으로 사용할 수 있습니다.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 rounded-md hover:bg-muted"
            aria-label="닫기"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
