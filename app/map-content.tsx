"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import hospitalsData from "../data/allergy-hospitals.json";

interface Hospital {
  name: string;
  region: string;
  district: string;
  address: string;
  depts: string[];
  doctors: Record<string, string[]>;
  tel: string;
  lat: number;
  lng: number;
  jext: boolean;
  firazyr?: boolean;
}

const HOSPITALS = hospitalsData as Hospital[];

const BRAND = "#3182f6";

const DEPT_COLORS: Record<string, string> = {
  내과: "#15803d",
  소아청소년과: "#7c3aed",
  피부과: "#c2410c",
  이비인후과: "#0e7490",
};

const DEPT_ORDER = ["내과", "소아청소년과", "피부과", "이비인후과"];

function regionLabel(r: string) {
  return r.replace("특별시", "").replace("광역시", "").replace("도", "");
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEARBY_RADIUS_KM = 20;

/* Bottom sheet geometry (mobile) */
const SHEET_HEIGHT_RATIO = 0.85; // sheet is 85% of viewport tall
const SHEET_HALF_RATIO = 0.45; // visible height at half state
const SHEET_PEEK_PX = 156; // visible height at peek state

type SheetState = "peek" | "half" | "full";

function kakaoDirectionsUrl(h: Hospital) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(h.name)},${h.lat},${h.lng}`;
}

/* ---------- Inline line icons (replaces emoji) ---------- */
type IconProps = { className?: string };

function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconPhone({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMapPin({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconNavigation({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function IconCrosshair({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
    </svg>
  );
}

function IconChevronDown({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconX({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconSliders({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7h-9M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}

function IconSpinner({ className }: IconProps) {
  return (
    <svg className={`animate-spin ${className ?? ""}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function AllergyMapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markerByIdxRef = useRef<Map<number, L.Marker>>(new Map());

  const [searchText, setSearchText] = useState("");
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set());
  const [activeDepts, setActiveDepts] = useState<Set<string>>(new Set());
  const [jextOnly, setJextOnly] = useState(false);
  const [firazyrOnly, setFirazyrOnly] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [textScale, setTextScale] = useState(2);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Mobile bottom sheet
  const [sheetState, setSheetState] = useState<SheetState>("half");
  const [dragY, setDragY] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startT: number } | null>(null);
  const dragMovedRef = useRef(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const regions = useMemo(
    () => [...new Set(HOSPITALS.map((h) => h.region))].sort(),
    []
  );

  const filtered = useMemo(() => {
    const results = HOSPITALS.filter((h) => {
      if (activeRegions.size && !activeRegions.has(h.region)) return false;
      if (activeDepts.size && !h.depts.some((d) => activeDepts.has(d)))
        return false;
      if (jextOnly && !h.jext) return false;
      if (firazyrOnly && !h.firazyr) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        const allDocs = Object.values(h.doctors).flat().join(" ").toLowerCase();
        const searchable =
          `${h.name} ${h.region} ${h.district} ${h.address} ${h.tel} ${allDocs}`.toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (nearbyMode && userLocation) {
        const dist = getDistanceKm(userLocation.lat, userLocation.lng, h.lat, h.lng);
        if (dist > NEARBY_RADIUS_KM) return false;
      }
      return true;
    });
    if (nearbyMode && userLocation) {
      results.sort((a, b) =>
        getDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        getDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    }
    return results;
  }, [searchText, activeRegions, activeDepts, jextOnly, firazyrOnly, nearbyMode, userLocation]);

  const activeFilterCount =
    activeRegions.size +
    activeDepts.size +
    (jextOnly ? 1 : 0) +
    (firazyrOnly ? 1 : 0) +
    (nearbyMode ? 1 : 0);

  const stats = useMemo(() => {
    const totalDocs = filtered.reduce(
      (s, h) => s + Object.values(h.doctors).flat().length,
      0
    );
    const jextCount = filtered.filter((h) => h.jext).length;
    const firazyrCount = filtered.filter((h) => h.firazyr).length;
    return {
      totalDocs,
      jextCount,
      firazyrCount,
      shown: filtered.length,
      total: HOSPITALS.length,
    };
  }, [filtered]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const isMobile = window.innerWidth < 768;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(
      [36.5, 127.5],
      7
    );
    if (!isMobile) {
      L.control.zoom({ position: "topleft" }).addTo(map);
    }
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when filtered changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    markerByIdxRef.current.clear();

    filtered.forEach((h) => {
      const primaryDept = h.depts[0];
      const color = DEPT_COLORS[primaryDept] || "#6b7280";
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([h.lat, h.lng], { icon }).addTo(map);

      let popupHtml = `<div style="font-family:system-ui,sans-serif;min-width:190px;max-width:270px">`;
      popupHtml += `<div style="font-weight:700;font-size:14px;margin-bottom:4px;word-break:keep-all">${h.name}</div>`;
      popupHtml += `<div style="font-size:11px;color:#64748b;margin-bottom:6px">${h.address}</div>`;
      DEPT_ORDER.forEach((d) => {
        if (h.doctors[d]) {
          popupHtml += `<div style="margin-bottom:3px"><span style="display:inline-block;padding:1px 6px;border-radius:8px;background:${DEPT_COLORS[d]};color:white;font-size:10px;font-weight:500">${d}</span> <span style="font-size:11px">${h.doctors[d].join(", ")}</span></div>`;
        }
      });
      const badges: string[] = [];
      if (h.jext)
        badges.push(`<span style="border:1px solid #d97706;color:#b45309;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700">Jext® 처방</span>`);
      if (h.firazyr)
        badges.push(`<span style="border:1px solid #0e7490;color:#155e75;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700">Firazyr® 처방</span>`);
      if (badges.length)
        popupHtml += `<div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${badges.join("")}</div>`;
      popupHtml += `<div style="display:flex;gap:6px;margin-top:9px">`;
      if (h.tel)
        popupHtml += `<a href="tel:${h.tel.replace(/[^0-9+-]/g, "")}" style="flex:1;text-align:center;background:${BRAND};color:#fff;font-size:11px;font-weight:700;padding:6px 0;border-radius:8px;text-decoration:none">전화하기</a>`;
      popupHtml += `<a href="${kakaoDirectionsUrl(h)}" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#f2f4f6;color:#333d4b;font-size:11px;font-weight:700;padding:6px 0;border-radius:8px;text-decoration:none">길찾기</a>`;
      popupHtml += `</div></div>`;

      const isMobile = window.innerWidth < 768;
      marker.bindPopup(popupHtml, { maxWidth: isMobile ? 260 : 300 });

      const globalIdx = HOSPITALS.indexOf(h);
      marker.on("click", () => setSelectedIdx(globalIdx));

      markersRef.current.push(marker);
      markerByIdxRef.current.set(globalIdx, marker);
    });

    if (filtered.length > 0 && filtered.length < HOSPITALS.length) {
      const bounds = L.latLngBounds(
        filtered.map((h) => [h.lat, h.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [filtered]);

  const selectHospital = useCallback((idx: number) => {
    setSelectedIdx(idx);
    const h = HOSPITALS[idx];
    const map = mapInstanceRef.current;
    if (!map) return;

    const isMobile = window.innerWidth < 768;
    map.setView([h.lat, h.lng], 14, { animate: false });
    if (isMobile) {
      // Keep marker in the visible area above the peeked sheet
      map.panBy([0, Math.round(window.innerHeight * 0.12)], { animate: false });
      setSheetState("peek");
    }
    markerByIdxRef.current.get(idx)?.openPopup();
  }, []);

  const toggleRegion = useCallback((region: string) => {
    setActiveRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }, []);

  const toggleDept = useCallback((dept: string) => {
    setActiveDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 서비스를 지원하지 않습니다.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setNearbyMode(true);
        setLocating(false);

        const map = mapInstanceRef.current;
        if (map) {
          if (userMarkerRef.current) {
            map.removeLayer(userMarkerRef.current);
          }
          const userIcon = L.divIcon({
            className: "custom-marker",
            html: `<div style="width:18px;height:18px;border-radius:50%;background:${BRAND};border:3px solid white;box-shadow:0 0 0 2px ${BRAND},0 2px 6px rgba(0,0,0,0.3)"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          userMarkerRef.current = L.marker([lat, lng], { icon: userIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:system-ui,sans-serif;font-size:13px;font-weight:600">현재 위치</div>`);
          map.setView([lat, lng], 12);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          alert("위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.");
        } else {
          alert("현재 위치를 가져올 수 없습니다. 다시 시도해 주세요.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const clearNearbyMode = useCallback(() => {
    setNearbyMode(false);
    setUserLocation(null);
    const map = mapInstanceRef.current;
    if (map && userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
  }, []);

  const resetAllFilters = useCallback(() => {
    setSearchText("");
    setActiveRegions(new Set());
    setActiveDepts(new Set());
    setJextOnly(false);
    setFirazyrOnly(false);
    clearNearbyMode();
  }, [clearNearbyMode]);

  // Scroll selected card into view (whichever list is visible)
  useEffect(() => {
    if (selectedIdx < 0) return;
    document.querySelectorAll(`[data-idx="${selectedIdx}"]`).forEach((el) => {
      if ((el as HTMLElement).offsetParent) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }, [selectedIdx]);

  /* ---------- Bottom sheet drag (mobile) ---------- */
  const sheetTranslateFor = useCallback((state: SheetState) => {
    const H = window.innerHeight;
    const sheetH = H * SHEET_HEIGHT_RATIO;
    if (state === "full") return 0;
    if (state === "half") return sheetH - H * SHEET_HALF_RATIO;
    return sheetH - SHEET_PEEK_PX;
  }, []);

  const onSheetPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startT: sheetTranslateFor(sheetState) };
      dragMovedRef.current = false;
    },
    [sheetState, sheetTranslateFor]
  );

  const onSheetPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dy) > 6) dragMovedRef.current = true;
    const H = window.innerHeight;
    const maxT = H * SHEET_HEIGHT_RATIO - SHEET_PEEK_PX;
    const t = Math.min(Math.max(dragRef.current.startT + dy, 0), maxT);
    setDragY(t);
  }, []);

  const onSheetPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const t = dragY ?? dragRef.current.startT;
    dragRef.current = null;
    setDragY(null);
    const targets: [SheetState, number][] = [
      ["full", sheetTranslateFor("full")],
      ["half", sheetTranslateFor("half")],
      ["peek", sheetTranslateFor("peek")],
    ];
    targets.sort((a, b) => Math.abs(a[1] - t) - Math.abs(b[1] - t));
    setSheetState(targets[0][0]);
  }, [dragY, sheetTranslateFor]);

  const onHandleClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setSheetState((s) => (s === "peek" ? "half" : s === "half" ? "full" : "half"));
  }, []);

  const sheetTransform =
    dragY !== null
      ? `translateY(${dragY}px)`
      : sheetState === "full"
        ? "translateY(0)"
        : sheetState === "half"
          ? `translateY(calc(${SHEET_HEIGHT_RATIO * 100}dvh - ${SHEET_HALF_RATIO * 100}dvh))`
          : `translateY(calc(${SHEET_HEIGHT_RATIO * 100}dvh - ${SHEET_PEEK_PX}px))`;

  /* ---------- Shared render helpers ---------- */

  const renderBadges = (h: Hospital) => (
    <>
      {h.jext && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 border border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-500 rounded-md font-bold"
          style={{ fontSize: `${9.5 * textScale}px` }}
        >
          Jext®
        </span>
      )}
      {h.firazyr && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 border border-cyan-700 text-cyan-800 dark:text-cyan-300 dark:border-cyan-500 rounded-md font-bold"
          style={{ fontSize: `${9.5 * textScale}px` }}
        >
          Firazyr®
        </span>
      )}
    </>
  );

  const renderCard = (h: Hospital) => {
    const idx = HOSPITALS.indexOf(h);
    const isSelected = idx === selectedIdx;
    const telHref = h.tel ? `tel:${h.tel.replace(/[^0-9+-]/g, "")}` : null;
    return (
      <div
        key={`${h.name}-${h.address}`}
        data-idx={idx}
        onClick={() => selectHospital(idx)}
        className={`px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20 ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-950/40 border-l-[3px] border-l-[#3182f6]"
            : ""
        }`}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold" style={{ fontSize: `${14 * textScale}px` }}>
            {h.name}
          </span>
          {renderBadges(h)}
        </div>
        <div
          className="text-muted-foreground mt-0.5 flex items-center gap-1.5"
          style={{ fontSize: `${11 * textScale}px` }}
        >
          <span>
            {h.region} {h.district}
          </span>
          {nearbyMode && userLocation && (
            <span className="text-[#3182f6] font-bold">
              {getDistanceKm(userLocation.lat, userLocation.lng, h.lat, h.lng).toFixed(1)}km
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {DEPT_ORDER.map((d) =>
            h.doctors[d] ? (
              <span
                key={d}
                className="px-2 py-0.5 rounded-full font-medium text-white"
                style={{ fontSize: `${10 * textScale}px`, backgroundColor: DEPT_COLORS[d] }}
              >
                {d} {h.doctors[d].length}
              </span>
            ) : null
          )}
        </div>

        {isSelected && (
          <div className="mt-2 pt-2 border-t border-dashed border-border">
            <div
              className="text-muted-foreground flex items-start gap-1.5 mb-1.5"
              style={{ fontSize: `${11 * textScale}px` }}
            >
              <IconMapPin className="h-[1.1em] w-[1.1em] mt-0.5 shrink-0" />
              <span>{h.address}</span>
            </div>
            <div className="text-muted-foreground leading-relaxed" style={{ fontSize: `${11 * textScale}px` }}>
              {DEPT_ORDER.map((d) =>
                h.doctors[d] ? (
                  <div key={d}>
                    <span className="font-semibold" style={{ color: DEPT_COLORS[d] }}>
                      {d}
                    </span>{" "}
                    {h.doctors[d].join(", ")}
                  </div>
                ) : null
              )}
            </div>
            <div className="flex gap-1.5 mt-2.5">
              {telHref && (
                <a
                  href={telHref}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-white bg-[#3182f6] hover:bg-[#2b74dc] transition-colors"
                  style={{ fontSize: `${11 * textScale}px` }}
                >
                  <IconPhone className="h-[1.1em] w-[1.1em]" />
                  전화하기
                </a>
              )}
              <a
                href={kakaoDirectionsUrl(h)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold bg-muted text-foreground hover:bg-muted/70 transition-colors"
                style={{ fontSize: `${11 * textScale}px` }}
              >
                <IconNavigation className="h-[1.1em] w-[1.1em]" />
                길찾기
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="px-4 py-10 text-center">
      <p className="text-muted-foreground mb-3" style={{ fontSize: `${13 * textScale}px` }}>
        검색 결과가 없습니다.
      </p>
      {(activeFilterCount > 0 || searchText) && (
        <button
          onClick={resetAllFilters}
          className="px-4 py-2 rounded-lg text-white bg-[#3182f6] font-bold"
          style={{ fontSize: `${11 * textScale}px` }}
        >
          검색·필터 초기화
        </button>
      )}
    </div>
  );

  const renderFilterTokens = () => (
    <>
      {[...activeRegions].map((r) => (
        <button
          key={r}
          onClick={() => toggleRegion(r)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#3182f6] text-white shadow-sm"
        >
          {regionLabel(r)}
          <IconX className="h-3 w-3" />
        </button>
      ))}
      {[...activeDepts].map((d) => (
        <button
          key={d}
          onClick={() => toggleDept(d)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold text-white shadow-sm"
          style={{ backgroundColor: DEPT_COLORS[d] }}
        >
          {d}
          <IconX className="h-3 w-3" />
        </button>
      ))}
      {jextOnly && (
        <button
          onClick={() => setJextOnly(false)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-sm"
        >
          Jext®
          <IconX className="h-3 w-3" />
        </button>
      )}
      {firazyrOnly && (
        <button
          onClick={() => setFirazyrOnly(false)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-cyan-700 text-white shadow-sm"
        >
          Firazyr®
          <IconX className="h-3 w-3" />
        </button>
      )}
    </>
  );

  const renderFiltersContent = () => (
    <div className="space-y-3">
      {/* Region Filter */}
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          지역
        </div>
        <div className="flex flex-wrap gap-1.5">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
                activeRegions.has(r)
                  ? "bg-[#3182f6] text-white border-[#3182f6]"
                  : "bg-card border-border hover:border-[#3182f6] hover:bg-blue-50 dark:hover:bg-blue-950/30"
              }`}
            >
              {regionLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {/* Dept Filter */}
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          진료과
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEPT_ORDER.map((d) => (
            <button
              key={d}
              onClick={() => toggleDept(d)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
                activeDepts.has(d)
                  ? "text-white border-transparent"
                  : "bg-card border-border hover:border-[#3182f6] hover:bg-blue-50 dark:hover:bg-blue-950/30"
              }`}
              style={
                activeDepts.has(d)
                  ? { backgroundColor: DEPT_COLORS[d], borderColor: DEPT_COLORS[d] }
                  : undefined
              }
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Medication toggles */}
      <div className="space-y-1">
        <label className="flex items-center justify-between gap-2 text-[13px] font-medium cursor-pointer select-none py-1.5">
          젝스트(Jext®) 처방 가능 병원만
          <input
            type="checkbox"
            checked={jextOnly}
            onChange={(e) => setJextOnly(e.target.checked)}
            className="accent-[#3182f6] h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-[13px] font-medium cursor-pointer select-none py-1.5">
          파라지르(Firazyr®) 처방 가능 병원만
          <input
            type="checkbox"
            checked={firazyrOnly}
            onChange={(e) => setFirazyrOnly(e.target.checked)}
            className="accent-cyan-700 h-4 w-4"
          />
        </label>
      </div>

      {/* Nearby location button */}
      <div>
        {nearbyMode ? (
          <button
            onClick={clearNearbyMode}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-[#3182f6] text-white hover:bg-[#2b74dc] transition-colors"
          >
            <IconCrosshair className="h-4 w-4" />내 주변 {NEARBY_RADIUS_KM}km 검색 중 — 해제
          </button>
        ) : (
          <button
            onClick={handleLocateMe}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-blue-50 text-[#3182f6] border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800 transition-colors disabled:opacity-50"
          >
            {locating ? (
              <IconSpinner className="h-4 w-4" />
            ) : (
              <IconCrosshair className="h-4 w-4" />
            )}
            {locating ? "위치 확인 중..." : "내 주변 병원 찾기"}
          </button>
        )}
      </div>

      {/* Text size control */}
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          글자 크기
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "기본", value: 1.5 },
            { label: "2배", value: 2 },
            { label: "크게", value: 2.5 },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => setTextScale(option.value)}
              className={`py-2 rounded-lg border text-[12px] font-semibold transition-colors ${
                textScale === option.value
                  ? "bg-[#3182f6] text-white border-[#3182f6]"
                  : "bg-card border-border hover:border-[#3182f6] hover:bg-blue-50 dark:hover:bg-blue-950/30"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Leaflet + Tailwind CSS fix */}
      <style>{`
        .leaflet-container img { max-width: none !important; max-height: none !important; }
        .leaflet-container { font-family: system-ui, sans-serif; font-size: 13px; }
        .custom-marker { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 12px; }
        .allergy-map-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
      `}</style>

      <div className="fixed inset-0 z-10 flex bg-background">
        {/* ===== Desktop sidebar (md+) ===== */}
        <div className="hidden md:flex flex-col w-[400px] shrink-0 border-r border-border bg-card overflow-hidden">
          {/* Header — flat white with brand mark */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#3182f6] text-white shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-extrabold leading-tight truncate">
                알레르기 전문의 병원 지도
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                대한천식알레르기학회 KAAACI
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 px-5 py-2 bg-muted/40 border-b border-border text-xs text-muted-foreground">
            전체 <span className="font-bold text-[#3182f6]">{stats.total}</span>곳 · 표시{" "}
            <span className="font-bold text-[#3182f6]">{stats.shown}</span>곳 · 전문의{" "}
            <span className="font-bold text-[#3182f6]">{stats.totalDocs}</span>명 · Jext®{" "}
            <span className="font-bold text-[#3182f6]">{stats.jextCount}</span> · Firazyr®{" "}
            <span className="font-bold text-[#3182f6]">{stats.firazyrCount}</span>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="병원명, 의사명, 지역, 주소 검색"
                className="w-full py-2 pl-9 pr-3 border border-border rounded-lg text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-[#3182f6]/25 focus:border-[#3182f6] transition-colors"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {nearbyMode && (
                  <button
                    onClick={clearNearbyMode}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#3182f6] text-white"
                  >
                    <IconCrosshair className="h-3 w-3" />
                    {NEARBY_RADIUS_KM}km
                    <IconX className="h-3 w-3" />
                  </button>
                )}
                {renderFilterTokens()}
              </div>
            )}
          </div>

          {/* Filter section toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className="w-full flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <IconSliders className="h-3.5 w-3.5" />
              필터 · 옵션
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[#3182f6] text-white rounded-full text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {filtersOpen ? "접기" : "펼치기"}
              <IconChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {/* Collapsible filters */}
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
              filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border">{renderFiltersContent()}</div>
            </div>
          </div>

          {/* Result Count */}
          <div
            className="px-4 py-1.5 text-muted-foreground bg-muted/50 border-b border-border"
            style={{ fontSize: `${11 * textScale}px` }}
          >
            검색 결과 <span className="font-bold text-foreground">{filtered.length}</span>곳
            {nearbyMode && " · 가까운 순"}
          </div>

          {/* Hospital List */}
          <div className="allergy-map-scroll flex-1 min-h-0 overflow-y-auto">
            {filtered.length === 0 ? renderEmptyState() : filtered.map(renderCard)}
          </div>
        </div>

        {/* ===== Map ===== */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* --- Mobile floating search + chips --- */}
          <div
            className="md:hidden absolute left-3 right-3 z-[1050]"
            style={{ top: "calc(12px + env(safe-area-inset-top, 0px))" }}
          >
            <div className="relative shadow-lg rounded-xl">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="병원명, 의사명, 지역 검색"
                className="w-full py-2.5 pl-10 pr-3 rounded-xl text-base bg-card border border-border focus:outline-none focus:ring-2 focus:ring-[#3182f6]/30 focus:border-[#3182f6]"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar -mr-3 pr-3">
              <button
                onClick={() => setFilterSheetOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-card border border-border shadow-sm"
              >
                <IconSliders className="h-3.5 w-3.5" />
                필터
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#3182f6] text-white rounded-full text-[10px] font-bold leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {nearbyMode ? (
                <button
                  onClick={clearNearbyMode}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#3182f6] text-white shadow-sm"
                >
                  <IconCrosshair className="h-3 w-3" />내 주변 {NEARBY_RADIUS_KM}km
                  <IconX className="h-3 w-3" />
                </button>
              ) : (
                <button
                  onClick={handleLocateMe}
                  disabled={locating}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-card border border-border shadow-sm disabled:opacity-50"
                >
                  {locating ? <IconSpinner className="h-3.5 w-3.5" /> : <IconCrosshair className="h-3.5 w-3.5 text-[#3182f6]" />}
                  내 주변
                </button>
              )}
              {renderFilterTokens()}
            </div>
          </div>

          {/* --- Mobile locate FAB --- */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            aria-label="현재 위치로 이동"
            className="md:hidden absolute right-3 z-[1050] w-11 h-11 bg-card rounded-full shadow-lg border border-border flex items-center justify-center active:bg-muted disabled:opacity-50"
            style={{ bottom: `calc(${SHEET_PEEK_PX}px + 14px + env(safe-area-inset-bottom, 0px))` }}
          >
            {locating ? (
              <IconSpinner className="h-5 w-5 text-[#3182f6]" />
            ) : (
              <IconCrosshair className="h-5 w-5 text-[#3182f6]" />
            )}
          </button>

          {/* --- Desktop locate button --- */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            className="hidden md:flex absolute top-3 right-3 z-[1000] w-10 h-10 bg-card rounded-lg shadow-lg border border-border items-center justify-center hover:bg-muted/60 disabled:opacity-50"
            title="현재 위치로 이동"
          >
            {locating ? (
              <IconSpinner className="h-5 w-5 text-[#3182f6]" />
            ) : (
              <IconCrosshair className="h-5 w-5 text-[#3182f6]" />
            )}
          </button>

          {/* Desktop nearby mode indicator */}
          {nearbyMode && (
            <div className="hidden md:flex absolute top-3 left-14 z-[1000] bg-[#3182f6] text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold items-center gap-2">
              <IconCrosshair className="h-3.5 w-3.5" />
              반경 {NEARBY_RADIUS_KM}km 내 병원
              <button
                onClick={clearNearbyMode}
                aria-label="내 주변 검색 해제"
                className="ml-1 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
              >
                <IconX className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Legend — desktop only */}
          <div
            className="hidden md:block absolute bottom-6 right-3 z-[1000] bg-card p-3 rounded-lg shadow-lg border border-border"
            style={{ fontSize: `${11 * textScale}px` }}
          >
            <div className="font-bold mb-1.5" style={{ fontSize: `${12 * textScale}px` }}>
              진료과 구분
            </div>
            {DEPT_ORDER.map((d) => (
              <div key={d} className="flex items-center gap-2 mb-0.5">
                <div
                  className="rounded-full"
                  style={{
                    width: `${10 * Math.min(textScale, 2)}px`,
                    height: `${10 * Math.min(textScale, 2)}px`,
                    backgroundColor: DEPT_COLORS[d],
                  }}
                />
                <span>{d === "내과" ? "내과 (알레르기내과)" : d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Mobile bottom sheet ===== */}
        <div
          className={`md:hidden fixed inset-x-0 bottom-0 z-[1100] h-[85dvh] flex flex-col bg-card rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.18)] ${
            dragY === null ? "transition-transform duration-300 ease-out" : ""
          }`}
          style={{ transform: sheetTransform }}
        >
          {/* Drag handle + header */}
          <div
            onPointerDown={onSheetPointerDown}
            onPointerMove={onSheetPointerMove}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={onSheetPointerUp}
            onClick={onHandleClick}
            className="shrink-0 cursor-grab active:cursor-grabbing px-4 pt-2 pb-1"
            style={{ touchAction: "none" }}
            role="button"
            aria-label="목록 열기/닫기"
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-2" />
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted-foreground">
                <span className="font-extrabold text-foreground" style={{ fontSize: `${12 * textScale}px` }}>
                  {filtered.length}곳
                </span>
                {nearbyMode ? " · 가까운 순" : ` · 전문의 ${stats.totalDocs}명`}
              </span>
              <span className="text-[11px] text-muted-foreground">
                대한천식알레르기학회 KAAACI
              </span>
            </div>
          </div>

          {/* Sheet list */}
          <div className="allergy-map-scroll flex-1 min-h-0 overflow-y-auto border-t border-border">
            {filtered.length === 0 ? renderEmptyState() : filtered.map(renderCard)}
            <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
          </div>
        </div>

        {/* ===== Mobile filter sheet (modal) ===== */}
        {filterSheetOpen && (
          <div className="md:hidden fixed inset-0 z-[1200]">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setFilterSheetOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 bg-card rounded-t-2xl max-h-[80dvh] flex flex-col">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
                <span className="text-[15px] font-extrabold flex items-center gap-2">
                  <IconSliders className="h-4 w-4 text-[#3182f6]" />
                  필터 · 옵션
                </span>
                <button
                  onClick={() => setFilterSheetOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-[13px] font-bold text-white bg-[#3182f6]"
                >
                  {filtered.length}곳 보기
                </button>
              </div>
              <div className="allergy-map-scroll overflow-y-auto px-5 py-4">
                {renderFiltersContent()}
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetAllFilters}
                    className="w-full mt-3 py-2.5 rounded-xl text-[13px] font-bold text-muted-foreground bg-muted hover:bg-muted/70"
                  >
                    전체 초기화
                  </button>
                )}
                <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
