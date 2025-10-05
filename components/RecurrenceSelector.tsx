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

// Daily configuration component
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

// Weekly configuration component
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

// Monthly configuration component
function MonthlyConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="form-label">Day of Month</label>
        <input
          type="number"
          min="1"
          max="31"
          value={config.day || 1}
          onChange={(e) => onChange({ ...config, day: parseInt(e.target.value) })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
        />
        <p className="form-hint mt-1">
          Day 1-31. For months with fewer days, the last day will be used.
        </p>
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

// Custom cron configuration component
function CustomConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  const [cronInput, setCronInput] = useState(config.cronExpression || '0 9 * * *')
  const [isValid, setIsValid] = useState(true)
  const [description, setDescription] = useState('')
  
  useEffect(() => {
    const valid = validateCronExpression(cronInput)
    setIsValid(valid)
    if (valid) {
      setDescription(describeCronExpression(cronInput))
      onChange({ ...config, cronExpression: cronInput })
    }
  }, [cronInput])
  
  return (
    <div className="space-y-3">
      <div>
        <label className="form-label">Cron Expression</label>
        <input
          type="text"
          value={cronInput}
          onChange={(e) => setCronInput(e.target.value)}
          placeholder="0 9 * * 1-5"
          className={`w-full bg-gray-700 border ${
            isValid ? 'border-gray-600' : 'border-red-500'
          } text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500`}
        />
        {isValid ? (
          <p className="form-hint mt-1 text-green-400">
            ✓ {description}
          </p>
        ) : (
          <p className="form-hint mt-1 text-red-400">
            Invalid cron expression. Format: minute hour day month weekday
          </p>
        )}
      </div>
      
      <div className="bg-gray-800 p-3 rounded-lg text-sm text-gray-300">
        <p className="font-semibold mb-2">Cron Format Examples:</p>
        <ul className="space-y-1">
          <li><code className="text-indigo-400">0 9 * * *</code> - Every day at 9:00 AM</li>
          <li><code className="text-indigo-400">0 9 * * 1-5</code> - Weekdays at 9:00 AM</li>
          <li><code className="text-indigo-400">0 */6 * * *</code> - Every 6 hours</li>
          <li><code className="text-indigo-400">0 0 1 * *</code> - First day of month at midnight</li>
        </ul>
      </div>
    </div>
  )
}