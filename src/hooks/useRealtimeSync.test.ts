// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { channel, removeChannel } = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn()
}));
vi.mock('../lib/supabase', () => ({ supabase: { channel, removeChannel } }));

import { useRealtimeSync } from './useRealtimeSync';

// 建立可鏈式呼叫的假 channel：.on(...).subscribe()
function makeChannel(capture?: (handler: () => void) => void) {
  const obj: Record<string, unknown> = {};
  obj.on = vi.fn((_event: string, _filter: unknown, handler: () => void) => {
    capture?.(handler);
    return obj;
  });
  obj.subscribe = vi.fn(() => obj);
  return obj;
}

describe('useRealtimeSync', () => {
  beforeEach(() => {
    channel.mockReset();
    removeChannel.mockReset();
    channel.mockImplementation(() => makeChannel());
  });

  it('onChange callback 變動時不重建 channel（避免換月拆/重建 websocket）', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(({ onChange }) => useRealtimeSync('f1', onChange), {
      initialProps: { onChange: cb1 }
    });
    expect(channel).toHaveBeenCalledTimes(1);

    rerender({ onChange: cb2 });
    expect(channel).toHaveBeenCalledTimes(1); // 未重建
    expect(removeChannel).not.toHaveBeenCalled();
  });

  it('familyId 變動時重建 channel', () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ familyId }) => useRealtimeSync(familyId, cb), {
      initialProps: { familyId: 'f1' as string | undefined }
    });
    expect(channel).toHaveBeenCalledTimes(1);

    rerender({ familyId: 'f2' });
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledTimes(2);
  });

  it('callback 變動後，事件觸發時呼叫最新的 callback', () => {
    let handler: (() => void) | undefined;
    channel.mockImplementation(() => makeChannel((h) => (handler = h)));
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(({ onChange }) => useRealtimeSync('f1', onChange), {
      initialProps: { onChange: cb1 }
    });

    rerender({ onChange: cb2 });
    handler?.();
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  it('familyId 為 undefined 時不建立 channel', () => {
    renderHook(() => useRealtimeSync(undefined, vi.fn()));
    expect(channel).not.toHaveBeenCalled();
  });
});
