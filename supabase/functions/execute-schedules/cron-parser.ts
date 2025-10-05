/**
 * Parse cron expression and calculate next execution time
 * Supports basic cron patterns commonly used for webhooks
 */
export function parseAndCalculateNext(cronExpression: string, fromDate: Date): Date {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length !== 5) {
    // Invalid cron, default to +1 day
    const next = new Date(fromDate)
    next.setDate(next.getDate() + 1)
    return next
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Handle common patterns
  if (cronExpression === '* * * * *') {
    // Every minute
    const next = new Date(fromDate)
    next.setMinutes(next.getMinutes() + 1)
    next.setSeconds(0, 0)
    return next
  }

  if (minute.startsWith('*/')) {
    // Every N minutes
    const interval = parseInt(minute.substring(2))
    const next = new Date(fromDate)
    next.setMinutes(next.getMinutes() + interval)
    next.setSeconds(0, 0)
    return next
  }

  if (hour.startsWith('*/')) {
    // Every N hours
    const interval = parseInt(hour.substring(2))
    const next = new Date(fromDate)
    next.setHours(next.getHours() + interval)
    next.setMinutes(0, 0, 0)
    return next
  }

  if (cronExpression === '0 * * * *') {
    // Every hour
    const next = new Date(fromDate)
    next.setHours(next.getHours() + 1)
    next.setMinutes(0, 0, 0)
    return next
  }

  if (cronExpression === '0 0 * * *') {
    // Daily at midnight
    const next = new Date(fromDate)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
    return next
  }

  // For more complex patterns, default to +1 day
  // In production, you'd want a full cron parser library
  const next = new Date(fromDate)
  next.setDate(next.getDate() + 1)
  return next
}