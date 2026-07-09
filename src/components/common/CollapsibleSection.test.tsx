// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CollapsibleSection } from './CollapsibleSection';

afterEach(cleanup);

describe('CollapsibleSection', () => {
  it('預設收合：不渲染內容', () => {
    render(
      <CollapsibleSection title="家庭圖表分析">
        <p>圖表內容</p>
      </CollapsibleSection>
    );
    expect(screen.queryByText('圖表內容')).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('點擊標題展開，再點收合', () => {
    render(
      <CollapsibleSection title="家庭圖表分析">
        <p>圖表內容</p>
      </CollapsibleSection>
    );
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    expect(screen.getByText('圖表內容')).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.queryByText('圖表內容')).toBeNull();
  });

  it('defaultOpen 可預設展開', () => {
    render(
      <CollapsibleSection title="家庭圖表分析" defaultOpen>
        <p>圖表內容</p>
      </CollapsibleSection>
    );
    expect(screen.getByText('圖表內容')).not.toBeNull();
  });
});
