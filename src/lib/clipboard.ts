/**
 * 文字列をクリップボードへ写す。成功したかを返す。
 *
 * `navigator.clipboard` は安全な文脈でしか使えず、権限が下りないこともあるので、
 * 古い `execCommand` を退避路として残す。黙って失敗させない。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 退避路へ落ちる。
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    // 画面を動かさずに選択する。iOS は表示されていない要素を選択できない。
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);

    area.select();
    area.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    area.remove();

    return copied;
  } catch {
    return false;
  }
}
