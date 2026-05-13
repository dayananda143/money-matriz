export function Table({ children, className = '' }) {
  return (
    <div className={`overflow-auto max-h-[60vh] -mx-0 ${className}`}>
      <table className="w-full text-sm min-w-max">{children}</table>
    </div>
  );
}

export function Th({ children, className = '', onClick }) {
  return (
    <th onClick={onClick} className={`table-header text-left px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-3 md:px-4 py-2.5 md:py-3 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap ${className}`}>
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
