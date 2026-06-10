interface FormStatusBadgeProps {
  isActive: boolean
}

export function FormStatusBadge({ isActive }: FormStatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isActive
          ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
          : 'bg-muted text-muted-foreground',
      ].join(' ')}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
