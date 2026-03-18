export function Table({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = '', onClick }) {
  return (
    <th onClick={onClick} className={`table-header text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/50 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 ${className}`}>
      {children}
    </td>
  );
}

export function EmptyRow({ cols, message = 'No data found' }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-10 text-gray-400 dark:text-gray-500">{message}</td>
    </tr>
  );
}
