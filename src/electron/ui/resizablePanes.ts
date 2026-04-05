export function initColResizer(
  resizerId: string,
  layout: HTMLElement,
  cssVar: string,
  sign: 1 | -1
): void {
  const resizer = document.getElementById(resizerId)!;
  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startSize = parseInt(getComputedStyle(layout).gridTemplateColumns.split(' ')[sign === 1 ? 0 : 4], 10);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizer.classList.add('dragging');

    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) * sign;
      layout.style.setProperty(cssVar, `${Math.max(120, Math.min(startSize + delta, window.innerWidth - 240))}px`);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function initRowResizer(resizerId: string, sidebar: HTMLElement): void {
  const resizer = document.getElementById(resizerId)!;
  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = parseInt(getComputedStyle(sidebar).getPropertyValue('--recent-panel-h') || '140', 10);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    resizer.classList.add('dragging');

    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(60, Math.min(startH + (ev.clientY - startY), sidebar.clientHeight - 80));
      sidebar.style.setProperty('--recent-panel-h', `${newH}px`);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
