import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Currency } from '../../types';
import { formatAmount } from '../../lib/currency';
import { markerRadius, type MapPlace } from '../../lib/geo';
import { colorSlices, sliceGradient } from '../../lib/mapColors';

interface ExpenseMapProps {
  places: MapPlace[];
  /** 圓點大小依哪個幣別的金額縮放。 */
  currency: Currency;
  /** 圓點顏色依項目（餐飲、交通、旅遊…）或依帳本來源（家庭、個人、旅遊）。 */
  colorBy: 'category' | 'source';
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

// 以 Leaflet + OpenStreetMap 圖磚繪製世界地圖；每個消費地點一個圓點，面積隨金額放大。
export function ExpenseMap({ places, currency, colorBy, selectedKey, onSelect }: ExpenseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = L.map(containerRef.current, { worldCopyJump: true, minZoom: 2 }).setView([25.03, 121.56], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // 地點變動時重畫圓點，並把視野縮放到全部足跡。
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const max = Math.max(0, ...places.map((place) => place.totals[currency]));
    for (const place of places) {
      const amount = place.totals[currency];
      const slices = colorSlices(place, currency, colorBy);
      const radius = markerRadius(amount, max);
      const selected = place.key === selectedKey;
      // 圓餅圖圓點：同一地點有多種項目／來源時，依金額比例疊出多種顏色。
      const icon = L.divIcon({
        className: '',
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
        html: `<div style="width:100%;height:100%;border-radius:50%;background:${sliceGradient(slices)};opacity:0.9;border:${
          selected ? '3px solid #0f172a' : '1.5px solid rgba(255,255,255,0.9)'
        };box-shadow:0 1px 3px rgba(0,0,0,0.35);box-sizing:border-box"></div>`
      });
      const marker = L.marker([place.latitude, place.longitude], { icon, keyboard: false });
      const breakdown = slices.map((slice) => `${slice.label} ${Math.round(slice.ratio * 100)}%`).join('・');
      // 用 DOM 節點 + textContent 組提示框：地點名稱是使用者輸入，不能當 HTML 解析。
      const tip = document.createElement('div');
      tip.textContent = `${place.name ?? '未命名地點'}・${place.count} 筆・${formatAmount(amount, currency)}`;
      if (breakdown) {
        const detail = document.createElement('div');
        detail.textContent = breakdown;
        tip.appendChild(detail);
      }
      marker.bindTooltip(tip);
      marker.on('click', () => onSelectRef.current(place.key));
      marker.addTo(layer);
    }
    if (places.length > 0) {
      const bounds = L.latLngBounds(places.map((place) => [place.latitude, place.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
    // 選取高亮只改外框，不應每次都重新縮放視野。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, currency, colorBy]);

  // 選取某地點：飛過去。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedKey) return;
    const place = places.find((candidate) => candidate.key === selectedKey);
    if (place) map.flyTo([place.latitude, place.longitude], Math.max(map.getZoom(), 11), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  return <div ref={containerRef} className="h-[55vh] min-h-72 w-full rounded-xl border border-slate-200" />;
}
