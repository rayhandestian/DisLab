
# Implementation Guide - Recurring Schedules

This guide provides detailed implementation instructions for adding recurring schedule support to Discord Lab.

## Table of Contents

1. [TypeScript Types & Interfaces](#typescript-types--interfaces)
2. [Cron Parser Utility](#cron-parser-utility)
3. [Schedule Service Updates](#schedule-service-updates)
4. [UI Components](#ui-components)
5. [Edge Function](#edge-function)
6. [Testing Guide](#testing-guide)

---

## TypeScript Types & Interfaces

### File: `lib/types/schedule.ts` (NEW)

Create this new file to centralize schedule-related types:

```typescript
// Recurrence pattern types
export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'

// Configuration for different recurrence patterns
export type RecurrenceConfig = {
  // For daily pattern
  time?: string // "HH:mm" format (24-hour)
  
  // For weekly pattern
  days?: number[] // 0-6, where 0 is Sunday, 1 is Monday, etc.
  
  // For monthly pattern
  day?: number // 1-31, day of month
  
  // For custom pattern
  cronExpression?: string // Standard cron format
  
  // Common fields
  timezone?: string // IANA timezone (e.g., "Asia/Jakarta")
}

// Extended schedule row type
export type ScheduleRow = {
  id: string
  user_id: string
  name: string
  webhook_url: string
  message_data: WebhookMessagePayload
  builder_state?: BuilderStateSnapshot
  files?: StoredFileAttachment[]
  
  // Scheduling fields
  schedule_time: string // ISO 8601 timestamp
  is_recurring: boolean
  recurrence_pattern?: RecurrencePattern
  cron_expression?: string
  recurrence_config?: RecurrenceConfig
  
  // Execution tracking
  is_active: boolean
  last_executed_at?: string
  next_execution_at?: string
  execution_count: number
  max_executions?: number
  
  // Metadata
  created_at: string
  updated_at: string
}

// Natural language parsing result
export type ParsedSchedule = {
  pattern: RecurrencePattern
  config: RecurrenceConfig
  cronExpression?: string
  description: string // Human-readable description
}

// Schedule creation parameters
export type CreateScheduleParams = {
  supabase: SupabaseClient
  userId: string
  name: string
  webhookUrl: string
  scheduleTime: Date | string
  snapshot: BuilderStateSnapshot
  files?: File[]
  
  // Recurrence fields
  isRecurring?: boolean
  recurrencePattern?: RecurrencePattern
  recurrenceConfig?: RecurrenceConfig
  maxExecutions?: number
}

// Schedule update parameters
export type UpdateScheduleParams = CreateScheduleParams & {
  scheduleId: string
  retainedFiles?: StoredFileAttachment[]
  filesToRemove?: StoredFileAttachment[]
  newFiles?: File[]
  isActive?: boolean
}
```

### Update: `lib/scheduleService.ts`

Add these imports and update the existing types:

```typescript
import type {
  RecurrencePattern,
  RecurrenceConfig,
  ScheduleRow,
  CreateScheduleParams,
  UpdateScheduleParams
} from './types/schedule'

// Update the existing ScheduleRow type to match the new definition
// (Remove the old type definition and import from types/schedule instead)

// Update createSchedule function signature
export const createSchedule = async ({
  supabase,
  userId,
  name,
  webhookUrl,
  scheduleTime,
  snapshot,
  files,
  isRecurring = false,
  recurrencePattern = 'once',
  recurrenceConfig,
  maxExecutions,
}: CreateScheduleParams): Promise<ScheduleRow> => {
  const scheduleId = generateId()
  const uploadedFiles = files?.length
    ? await uploadScheduleFiles({ supabase, userId, scheduleId, files })
    : []

  const snapshotWithFiles: BuilderStateSnapshot = {
    ...snapshot,
    files: uploadedFiles,
  }

  const insertPayload = createScheduleInsertPayload({
    userId,
    name,
    webhookUrl,
    scheduleTime,
    snapshot: snapshotWithFiles,
    files: uploadedFiles,
  })

  // Calculate next_execution_at
  const nextExecutionAt = typeof scheduleTime === 'string' 
    ? new Date(scheduleTime).toISOString() 
    : scheduleTime.toISOString()

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .insert({
      id: scheduleId,
      ...insertPayload,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern,
      recurrence_config: recurrenceConfig,
      next_execution_at: nextExecutionAt,
      max_executions: maxExecutions,
    })
    .select()
    .single()

  if (error) {
    if (uploadedFiles.length > 0) {
      void removeScheduleFiles(supabase, uploadedFiles)
    }
    throw error
  }

  return data as ScheduleRow
}

// Similar updates for updateSchedule function...
```

---

## Cron Parser Utility

### File: `lib/cronParser.ts` (NEW)

```typescript
import type { ParsedSchedule, RecurrencePattern, RecurrenceConfig } from './types/schedule'

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
```

---

## Schedule Service Updates

### Update: `lib/scheduleService.ts`

Add these new functions:

```typescript
/**
 * Calculate the next execution time for a recurring schedule
 */
export function calculateNextExecution(
  pattern: RecurrencePattern,
  config: RecurrenceConfig,
  fromDate: Date = new Date()
): Date {
  const next = new Date(fromDate)
  
  switch (pattern) {
    case 'once':
      return next
      
    case 'daily':
      next.setDate(next.getDate() + 1)
      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number)
        next.setHours(hours, minutes, 0, 0)
      }
      break
      
    case 'weekly':
      if (config.days && config.days.length > 0) {
        const currentDay = next.getDay()
        const sortedDays = [...config.days].sort()
        
        // Find next day in the week
        let nextDay = sortedDays.find(d => d > currentDay)
        
        if (nextDay === undefined) {
          // Wrap to next week
          nextDay = sortedDays[0]
          next.setDate(next.getDate() + (7 - currentDay + nextDay))
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay))
        }
        
        if (config.time) {
          const [hours, minutes] = config.time.split(':').map(Number)
          next.setHours(hours, minutes, 0, 0)
        }
      }
      break
      
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      if (config.day) {
        next.setDate(config.day)
      }
      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number)
        next.setHours(hours, minutes, 0, 0)
      }
      break
      
    case 'custom':
      // For custom cron, this would need a proper cron parser
      // For now, default to +1 day
      next.setDate(next.getDate() + 1)
      break
  }
  
  return next
}

/**
 * Check if a schedule should continue executing
 */
export function shouldContinueExecution(schedule: ScheduleRow): boolean {
  if (!schedule.is_recurring) return false
  if (!schedule.is_active) return false
  if (schedule.max_executions && schedule.execution_count >= schedule.max_executions) {
    return false
  }
  return true
}
```

---

## UI Components

### Component: `components/RecurrenceSelector.tsx` (NEW)

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { RecurrencePattern, RecurrenceConfig, ParsedSchedule } from '@/lib/types/schedule'
import { parseNaturalLanguage, validateCronExpression, describeCronExpression, getSchedulePresets } from '@/lib/cronParser'

type RecurrenceSelectorProps = {
  pattern: RecurrencePattern
  config: RecurrenceConfig
  onPatternChange: (pattern: RecurrencePattern) => void
  onConfigChange: (config: RecurrenceConfig) => void
}

export default function RecurrenceSelector({
  pattern,
  config,
  onPatternChange,
  onConfigChange
}: RecurrenceSelectorProps) {
  const [naturalInput, setNaturalInput] = useState('')
  const [parsedResult, setParsedResult] = useState<ParsedSchedule | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  
  const presets = getSchedulePresets()
  
  const handleNaturalInput = (value: string) => {
    setNaturalInput(value)
    const parsed = parseNaturalLanguage(value)
    setParsedResult(parsed)
    
    if (parsed) {
      onPatternChange(parsed.pattern)
      onConfigChange(parsed.config)
    }
  }
  
  const handlePresetSelect = (preset: string) => {
    setNaturalInput(preset)
    handleNaturalInput(preset)
    setShowPresets(false)
  }
  
  return (
    <div className="space-y-4">
      {/* Pattern Type Selector */}
      <div>
        <label className="form-label">Recurrence Pattern</label>
        <select
          value={pattern}
          onChange={(e) => onPatternChange(e.target.value as RecurrencePattern)}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="once">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom (Cron)</option>
        </select>
      </div>
      
      {/* Natural Language Input */}
      {pattern !== 'once' && (
        <div>
          <label className="form-label">
            Natural Language (Optional)
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="ml-2 text-xs text-indigo-400 hover:text-indigo-300"
            >
              {showPresets ? 'Hide' : 'Show'} Presets
            </button>
          </label>
          
          {showPresets && (
            <div className="mb-2 p-3 bg-gray-800 rounded-lg space-y-1">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetSelect(preset.value)}
                  className="block w-full text-left text-sm text-gray-300 hover:text-white hover:bg-gray-700 px-2 py-1 rounded"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          
          <input
            type="text"
            value={naturalInput}
            onChange={(e) => handleNaturalInput(e.target.value)}
            placeholder='e.g., "every Monday at 9 AM" or "daily at 2:30 PM"'
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
          />
          
          {parsedResult && (
            <p className="mt-1 text-sm text-green-400">
              ✓ {parsedResult.description}
            </p>
          )}
          
          {naturalInput && !parsedResult && (
            <p className="mt-1 text-sm text-yellow-400">
              Could not parse. Use the fields below instead.
            </p>
          )}
        </div>
      )}
      
      {/* Pattern-Specific Fields */}
      {pattern === 'daily' && (
        <DailyConfig config={config} onChange={onConfigChange} />
      )}
      
      {pattern === 'weekly' && (
        <WeeklyConfig config={config} onChange={onConfigChange} />
      )}
      
      {pattern === 'monthly' && (
        <MonthlyConfig config={config} onChange={onConfigChange} />
      )}
      
      {pattern === 'custom' && (
        <CustomConfig config={config} onChange={onConfigChange} />
      )}
    </div>
  )
}

// Sub-components for each pattern type...

function DailyConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  return (
    <div>
      <label className="form-label">Time</label>
      <input
        type="time"
        value={config.time || '09:00'}
        onChange={(e) => onChange({ ...config, time: e.target.value })}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

function WeeklyConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  const days = config.days || []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const toggleDay = (day: number) => {
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort()
    onChange({ ...config, days: newDays })
  }
  
  return (
    <div className="space-y-3">
      <div>
        <label className="form-label">Days of Week</label>
        <div className="flex gap-2 flex-wrap">
          {dayNames.map((name, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                days.includes(idx)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <label className="form-label">Time</label>
        <input
          type="time"
          value={config.time || '09:00'}
          onChange={(e) => onChange({ ...config, time: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  )
}

function MonthlyConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label