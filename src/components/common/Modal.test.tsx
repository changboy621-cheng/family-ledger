// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

afterEach(cleanup);

function renderModal(onClose = vi.fn()) {
  render(
    <Modal title="新增記帳" onClose={onClose}>
      <button>第一顆</button>
      <input aria-label="金額" />
      <button>最後一顆</button>
    </Modal>
  );
  return onClose;
}

describe('Modal a11y', () => {
  it('具備 dialog 語意', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('新增記帳');
  });

  it('開啟時焦點移入對話框第一個可聚焦元素', () => {
    renderModal();
    expect(document.activeElement?.textContent).toBe('第一顆');
  });

  it('Esc 關閉', () => {
    const onClose = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點背景關閉，但點對話框內容不關閉', () => {
    const onClose = renderModal();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab 在最後一顆時環繞回第一顆（focus trap）', () => {
    renderModal();
    const last = screen.getByText('最後一顆');
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement?.textContent).toBe('第一顆');
  });
});
