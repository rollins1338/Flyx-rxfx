export interface CommandItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  section: 'navigation' | 'recent';
}

/**
 * Determines if a navigation item is active based on the current path.
 * Exact match for root `/`, prefix match for all other paths.
 */
export function isActiveRoute(itemPath: string, currentPath: string): boolean {
  if (itemPath === '/') return currentPath === '/';
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
}

/**
 * Filters command items by a case-insensitive substring match on label.
 * Returns all items when query is empty.
 */
export function filterCommandItems(
  items: CommandItem[],
  query: string
): CommandItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return items;
  return items.filter(item =>
    item.label.toLowerCase().includes(normalizedQuery)
  );
}
