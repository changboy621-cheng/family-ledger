import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, MapPin, X } from 'lucide-react';
import { getCurrentCoordinates, locationErrorMessage, type Coordinates } from '../../lib/geo';
import { reverseGeocode } from '../../lib/geocode';
import { readPhotoMeta } from '../../lib/photoMeta';
import { useUIStore } from '../../store/uiStore';

const AUTO_LOCATE_KEY = 'family-ledger:autoLocate';

function loadAutoLocate(): boolean {
  try {
    return localStorage.getItem(AUTO_LOCATE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveAutoLocate(value: boolean) {
  try {
    localStorage.setItem(AUTO_LOCATE_KEY, value ? '1' : '0');
  } catch {
    // 無痕模式等情況無法寫入，忽略即可。
  }
}

interface LocationPickerProps {
  coords: Coordinates | null;
  placeName: string;
  onChange: (coords: Coordinates | null, placeName: string) => void;
  /** 照片 EXIF 帶有拍攝日期時通知上層（可選）。 */
  onPhotoDate?: (date: string) => void;
  /** 新增模式才會依「自動記錄位置」偏好在開啟時定位一次。 */
  autoLocateOnMount?: boolean;
}

/** 消費地點欄位（目前位置／照片 EXIF／反查地名），與家庭、個人記帳共用同一個「自動記錄位置」偏好。 */
export function LocationPicker({ coords, placeName, onChange, onPhotoDate, autoLocateOnMount = false }: LocationPickerProps) {
  const showToast = useUIStore((state) => state.showToast);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [autoLocate, setAutoLocate] = useState(() => loadAutoLocate());
  const photoInputRef = useRef<HTMLInputElement>(null);
  // 以 ref 取最新的 props，讓下面的 effect／callback 不必把它們列為依賴。
  const latest = useRef({ coords, placeName, onChange });
  latest.current = { coords, placeName, onChange };
  const initialCoords = useRef(coords);

  const locate = useCallback(async () => {
    setLocating(true);
    setLocationError('');
    try {
      const found = await getCurrentCoordinates();
      latest.current.onChange(found, latest.current.placeName);
    } catch (error) {
      setLocationError(locationErrorMessage(error));
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (autoLocateOnMount && autoLocate && !coords) void locate();
    // 只在開表單時跑一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 取得新座標後，名稱還空著就自動查地名（只送經緯度給 OpenStreetMap）；編輯時原座標不重查。
  const lat = coords?.latitude;
  const lng = coords?.longitude;
  useEffect(() => {
    const current = latest.current;
    if (!current.coords || current.placeName.trim()) return undefined;
    if (current.coords.latitude === initialCoords.current?.latitude && current.coords.longitude === initialCoords.current?.longitude) {
      return undefined;
    }
    const controller = new AbortController();
    void reverseGeocode(current.coords, controller.signal).then((name) => {
      if (name && !controller.signal.aborted && !latest.current.placeName.trim()) {
        latest.current.onChange(latest.current.coords, name);
      }
    });
    return () => controller.abort();
  }, [lat, lng]);

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocating(true);
    setLocationError('');
    const meta = await readPhotoMeta(file);
    setLocating(false);
    if (meta.coordinates) latest.current.onChange(meta.coordinates, latest.current.placeName);
    if (meta.date) onPhotoDate?.(meta.date);
    if (meta.coordinates) {
      showToast(meta.date && onPhotoDate ? '已從照片帶入位置與日期' : '已從照片帶入位置');
    } else {
      setLocationError('這張照片沒有位置資訊（iPhone 從相簿選取常會被移除），可改按「記錄目前位置」。');
    }
  }

  function toggleAutoLocate() {
    const next = !autoLocate;
    setAutoLocate(next);
    saveAutoLocate(next);
    if (next && !coords) void locate();
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">消費地點</span>
      {coords ? (
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-family" aria-hidden="true" />
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
            value={placeName}
            onChange={(event) => onChange(coords, event.target.value)}
            placeholder="地點名稱（會自動查詢，可自行修改）"
            aria-label="地點名稱"
          />
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            onClick={() => {
              setLocationError('');
              onChange(null, '');
            }}
            aria-label="移除位置"
            title="移除位置"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          onClick={() => void locate()}
          disabled={locating}
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {locating ? '定位中...' : '記錄目前位置'}
        </button>
      )}
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handlePhoto(event)} />
      <button
        type="button"
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        onClick={() => photoInputRef.current?.click()}
        disabled={locating}
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        用收據／照片帶入位置
      </button>
      {coords ? (
        <p className="text-xs text-slate-400">
          已定位（{coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}），會顯示在「消費地圖」。
        </p>
      ) : null}
      {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={autoLocate} onChange={toggleAutoLocate} />
        新增記帳時自動記錄位置
      </label>
    </div>
  );
}
