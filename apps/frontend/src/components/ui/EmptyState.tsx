/** For grid/card layouts (e.g. the model list). */
export function EmptyState({ message }: { message: string }) {
  return <p className="text-slate-500">{message}</p>;
}

/** For a `<tbody>` row spanning the full table width - pass the column count. */
export function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-4 text-center text-slate-400">
        {message}
      </td>
    </tr>
  );
}
