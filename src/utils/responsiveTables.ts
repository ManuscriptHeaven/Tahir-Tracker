/**
 * Phone-portrait report support.
 *
 * Report tables are too wide for a phone held upright. On narrow screens the
 * CSS in index.css turns every row of a `table[data-stack]` into a small card,
 * printing each cell's column name beside its value. This helper copies the
 * column names from each table's header onto its cells as `data-label`, so the
 * report markup itself does not have to repeat them.
 *
 * Tables with the `report-keep-table` class are left as normal tables.
 */
export function labelStackedTableCells(root: HTMLElement | null): void {
  if (!root) return;

  root.querySelectorAll('table').forEach(table => {
    if (table.classList.contains('report-keep-table')) {
      table.removeAttribute('data-stack');
      return;
    }

    const headerRows = table.tHead?.rows;
    const headerRow = headerRows && headerRows.length > 0 ? headerRows[headerRows.length - 1] : null;
    const labels: string[] = [];
    if (headerRow) {
      Array.from(headerRow.cells).forEach(cell => {
        const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        for (let i = 0; i < Math.max(1, cell.colSpan); i++) labels.push(text);
      });
    }

    table.setAttribute('data-stack', '');

    const bodyRows = [
      ...Array.from(table.tBodies).flatMap(body => Array.from(body.rows)),
      ...(table.tFoot ? Array.from(table.tFoot.rows) : [])
    ];

    bodyRows.forEach(row => {
      let column = 0;
      Array.from(row.cells).forEach(cell => {
        const span = Math.max(1, cell.colSpan);
        const label = span === 1 ? labels[column] : '';
        if (label) {
          if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
        } else if (cell.hasAttribute('data-label')) {
          cell.removeAttribute('data-label');
        }
        column += span;
      });
    });
  });
}
