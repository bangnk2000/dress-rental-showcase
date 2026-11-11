import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

function Example({ stacked }: { stacked?: boolean }) {
  return (
    <Table stacked={stacked}>
      <TableHeader>
        <TableRow>
          <TableHead>Khách</TableHead>
          <TableHead>Điện thoại</TableHead>
          <TableHead>Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell stack="title" label="Khách">
            Lan
          </TableCell>
          <TableCell label="Điện thoại">0901</TableCell>
          <TableCell stack="actions">
            <button type="button">Sửa</button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

test('a default table adds no explicit roles or stacked markup (behaviour unchanged)', () => {
  const { container } = render(<Example />);

  expect(container.querySelector('[role]:not(button)')).toBeNull();
  expect(container.querySelector('[data-stacked]')).toBeNull();
  expect(container.querySelector('[data-label]')).toBeNull();
  // implicit roles still resolve
  expect(screen.getAllByRole('row')).toHaveLength(2);
});

test('a stacked table spells out the implicit roles, so role queries are identical', () => {
  render(<Example stacked />);

  const table = screen.getByRole('table');
  expect(table).toHaveAttribute('role', 'table');
  expect(table).toHaveAttribute('data-stacked');
  expect(screen.getAllByRole('rowgroup')).toHaveLength(2);
  expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
    'Khách',
    'Điện thoại',
    'Thao tác',
  ]);
  const rows = screen.getAllByRole('row');
  expect(rows).toHaveLength(2); // header row stays in the DOM (visually hidden below md)
  expect(within(rows[1]!).getAllByRole('cell')).toHaveLength(3);
  expect(screen.getByRole('row', { name: /Lan/ })).toBe(rows[1]);
});

test('a stacked cell carries its column label; the title cell does not', () => {
  render(<Example stacked />);

  const [title, phone, actions] = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
  expect(phone).toHaveAttribute('data-label', 'Điện thoại');
  expect(title).not.toHaveAttribute('data-label');
  expect(actions).not.toHaveAttribute('data-label');
  // the label is CSS generated content, never a DOM text node
  expect(phone).toHaveTextContent(/^0901$/);
});

test('an explicit role prop wins over the injected one', () => {
  render(
    <Table stacked>
      <TableBody>
        <TableRow>
          <TableHead role="rowheader">Lan</TableHead>
          <TableCell>0901</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );

  expect(screen.getByRole('rowheader')).toHaveTextContent('Lan');
});
