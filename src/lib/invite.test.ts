import { describe, expect, it } from 'vitest';
import { INVITE_BASE_URL, buildInviteText, buildJoinUrl } from './invite';

describe('buildJoinUrl', () => {
  it('用預設網址組出 /auth/join?code= 連結', () => {
    expect(buildJoinUrl('ABC123')).toBe(`${INVITE_BASE_URL}/auth/join?code=ABC123`);
  });

  it('邀請碼自動去空白並轉大寫', () => {
    expect(buildJoinUrl('  abc123 ')).toBe(`${INVITE_BASE_URL}/auth/join?code=ABC123`);
  });

  it('可指定自訂 baseUrl（測試環境用）', () => {
    expect(buildJoinUrl('XY9K7P', 'https://example.test')).toBe(
      'https://example.test/auth/join?code=XY9K7P'
    );
  });
});

describe('buildInviteText', () => {
  it('包含家庭名稱、邀請碼與加入連結', () => {
    const text = buildInviteText({ familyName: '陳家', inviteCode: 'ABC123' });
    expect(text).toContain('陳家');
    expect(text).toContain('ABC123');
    expect(text).toContain(buildJoinUrl('ABC123'));
  });

  it('沒有家庭名稱時用「我們的家」當預設', () => {
    const text = buildInviteText({ inviteCode: 'ABC123' });
    expect(text).toContain('我們的家');
  });

  it('提供手動加入備援（含基底網址）', () => {
    const text = buildInviteText({ inviteCode: 'abc123' });
    expect(text).toContain(INVITE_BASE_URL);
    // 邀請碼在文字中一律大寫呈現
    expect(text).toContain('ABC123');
    expect(text).not.toContain('abc123');
  });
});
