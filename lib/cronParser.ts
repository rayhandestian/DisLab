import type { ParsedSchedule } from './types/schedule'

/**
 * Parse natural language input into a schedule configuration
 */
export function parseNaturalLanguage(input: string): ParsedSchedule | null {
  const lower = input.toLowerCase().trim()
  
  // Daily patterns
  const dailyMatch = lower.match(/^(?:every\s*day|daily)\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
  if (dailyMatch) {
    const time = normalizeTime(dailyMatch[1], dailyMatch[2], dailyMatch[3])
    return {
      pattern: 'daily',
      config: { time },
      description: `Every day at ${time}`
    }
  }
  
  // Weekly patterns - specific days
  const weeklyMatch = lower.match(/^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+and\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))*\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
  if (weeklyMatch) {
    const days = extractDaysFromMatch(lower)
    const timeMatch = lower.match(/at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
    const time = timeMatch ? normalizeTime(timeMatch[1], timeMatch[2], timeMatch[3]) : '09:00'
    
    return {
      pattern: 'weekly',
      config: { days, time },
      description: `Every ${formatDays(days)} at ${time}`
    }
  }
  
  // Weekday pattern
  if (lower.match(/^(?:every\s*)?weekday/i)) {
    const timeMatch = lower.match(/at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
    const time = timeMatch ? normalizeTime(timeMatch[1], timeMatch[2], timeMatch[3]) : '09:00'
    
    return {
      pattern: 'weekly',
      config: { days: [1, 2, 3, 4, 5], time }, // Mon-Fri
      description: `Every weekday at ${time}`
    }
  }
  
  // Weekend pattern
  if (lower.match(/^(?:every\s*)?weekend/i)) {
    const timeMatch = lower.match(/at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
    const time = timeMatch ? normalizeTime(timeMatch[1], timeMatch[2], timeMatch[3]) : '09:00'
    
    return {
      pattern: 'weekly',
      config: { days: [0, 6], time }, // Sun, Sat
      description: `Every weekend at ${time}`
    }
  }
  
  // Monthly patterns
  const monthlyMatch = lower.match(/^(?:every\s*month|monthly)\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
  if (monthlyMatch) {
    const day = parseInt(monthlyMatch[1])
    const time = normalizeTime(monthlyMatch[2], monthlyMatch[3], monthlyMatch[4])
    
    if (day >= 1 && day <= 31) {
      return {
        pattern: 'monthly',
        config: { day, time },
        description: `Every month on the ${formatOrdinal(day)} at ${time}`
      }
    }
  }
  
  // Hourly pattern
  const hourlyMatch = lower.match(/^every\s+(\d+)\s+hours?$/i)
  if (hourlyMatch) {
    const hours = parseInt(hourlyMatch[1])
    const cronExpression = `0 */${hours} * * *`
    
    return {
      pattern: 'custom',
      config: { cronExpression },
      cronExpression,
      description: `Every ${hours} hour${hours > 1 ? 's' : ''}`
    }
  }
  
  return null
}

/**
 * Validate a cron expression
 */
export function validateCronExpression(expression: string): boolean {
  // Basic cron validation (5 fields: minute hour day month weekday)
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false
  
  // Each part should be valid
  const patterns = [
    /^(\*|([0-5]?\d)(,([0-5]?\d))*|([0-5]?\d)-([0-5]?\d)(\/\d+)?)$/, // minute
    /^(\*|([01]?\d|2[0-3])(,([01]?\d|2[0-3]))*|([01]?\d|2[0-3])-([01]?\d|2[0-3])(\/\d+)?)$/, // hour
    /^(\*|([1-9]|[12]\d|3[01])(,([1-9]|[12]\d|3[01]))*|([1-9]|[12]\d|3[01])-([1-9]|[12]\d|3[01])(\/\d+)?)$/, // day
    /^(\*|([1-9]|1[0-2])(,([1-9]|1[0-2]))*|([1-9]|1[0-2])-([1-9]|1[0-2])(\/\d+)?)$/, // month
    /^(\*|[0-6](,[0-6])*|[0-6]-[0-6](\/\d+)?)$/, // weekday
  ]
  
  return parts.every((part, index) => patterns[index].test(part))
}

/**
 * Get human-readable description of a cron expression
 */
export function describeCronExpression(expression: string): string {
  if (!validateCronExpression(expression)) {
    return 'Invalid cron expression'
  }
  
  const [minute, hour, day, month, weekday] = expression.split(/\s+/)
  
  // Simple cases
  if (expression === '* * * * *') return 'Every minute'
  if (expression === '0 * * * *') return 'Every hour'
  if (expression === '0 0 * * *') return 'Every day at midnight'
  if (expression === '0 9 * * 1-5') return 'Every weekday at 9:00 AM'
  
  // Build description
  let desc = 'At '
  
  if (minute === '*') desc += 'every minute'
  else desc += `minute ${minute}`
  
  if (hour !== '*') desc += ` past hour ${hour}`
  if (day !== '*') desc += ` on day ${day}`
  if (month !== '*') desc += ` in month ${month}`
  if (weekday !== '*') desc += ` on weekday ${weekday}`
  
  return desc
}

// Helper functions

function normalizeTime(hour: string, minute?: string, period?: string): string {
  let h = parseInt(hour)
  const m = minute ? parseInt(minute) : 0
  
  if (period) {
    if (period.toLowerCase() === 'pm' && h !== 12) h += 12
    if (period.toLowerCase() === 'am' && h === 12) h = 0
  }
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function extractDaysFromMatch(text: string): number[] {
  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6
  }
  
  const days: number[] = []
  for (const [name, num] of Object.entries(dayMap)) {
    if (text.includes(name)) {
      if (!days.includes(num)) days.push(num)
    }
  }
  
  return days.sort()
}

function formatDays(days: number[]): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const names = days.map(d => dayNames[d])
  
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' and ')
  
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1]
}

function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Get common schedule presets
 */
export function getSchedulePresets(): Array<{ label: string; value: string }> {
  return [
    { label: 'Every day at 9 AM', value: 'daily at 9:00' },
    { label: 'Every weekday at 9 AM', value: 'every weekday at 9:00' },
    { label: 'Every Monday at 9 AM', value: 'every monday at 9:00' },
    { label: 'Every weekend at 10 AM', value: 'every weekend at 10:00' },
    { label: 'Monthly on the 1st at noon', value: 'monthly on the 1st at 12:00' },
    { label: 'Every 6 hours', value: 'every 6 hours' },
    { label: 'Every 12 hours', value: 'every 12 hours' },
  ]
}