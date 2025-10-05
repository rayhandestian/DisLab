'use client'

import { useState, useEffect } from 'react'
import { Clock, Calendar, Repeat, Settings, ChevronDown, Check } from 'lucide-react'
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
  
  const patternOptions = [
    { value: 'once', label: 'One-time', icon: Clock, description: 'Run once at specified time' },
    { value: 'daily', label: 'Daily', icon: Calendar, description: 'Repeat every day' },
    { value: 'weekly', label: 'Weekly', icon: Repeat, description: 'Repeat on selected days' },
    { value: 'monthly', label: 'Monthly', icon: Calendar, description: 'Repeat on specific date' },
    { value: 'custom', label: 'Custom (Cron)', icon: Settings, description: 'Advanced cron expression' },
  ]

  return (
    <div className="space-y-6">
      {/* Pattern Type Selector */}
      <div>
        <label className="form-label flex items-center gap-2">
          <Repeat className="w-4 h-4 text-indigo-400" />
          Recurrence Pattern
        </label>
        <div className="grid grid-cols-1 gap-2">
          {patternOptions.map((option) => {
            const Icon = option.icon
            const isSelected = pattern === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onPatternChange(option.value as RecurrencePattern)}
                className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-800/70 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-gray-400">{option.description}</div>
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Natural Language Input */}
      {pattern !== 'once' && (
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <label className="form-label flex items-center gap-2 mb-0">
              <Settings className="w-4 h-4 text-indigo-400" />
              Quick Setup
            </label>
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              {showPresets ? 'Hide' : 'Show'} Examples
              <ChevronDown className={`w-4 h-4 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showPresets && (
            <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 mb-3 font-medium">Click to apply:</p>
              <div className="grid gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetSelect(preset.value)}
                    className="w-full text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/70 px-3 py-2 rounded-md transition-all duration-150 flex items-center gap-2 group"
                  >
                    <div className="w-2 h-2 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-gray-500 text-xs">→ {preset.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <input
              type="text"
              value={naturalInput}
              onChange={(e) => handleNaturalInput(e.target.value)}
              placeholder='Try: "every Monday at 9 AM", "daily at 2:30 PM", "weekdays at 8 AM"'
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />

            {parsedResult && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
                <Check className="w-4 h-4" />
                <span>{parsedResult.description}</span>
              </div>
            )}

            {naturalInput && !parsedResult && (
              <div className="mt-2 flex items-center gap-2 text-sm text-yellow-400">
                <Settings className="w-4 h-4" />
                <span>Could not parse. Use the manual fields below instead.</span>
              </div>
            )}
          </div>
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
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-indigo-400" />
        <label className="form-label mb-0">Daily Schedule</label>
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Time</label>
        <input
          type="time"
          value={config.time || '09:00'}
          onChange={(e) => onChange({ ...config, time: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">Runs every day at this time</p>
      </div>
    </div>
  )
}

// Weekly configuration component
function WeeklyConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  const days = config.days || []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const toggleDay = (day: number) => {
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort()
    onChange({ ...config, days: newDays })
  }

  return (
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-indigo-400" />
        <label className="form-label mb-0">Weekly Schedule</label>
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-3 block">Days of Week</label>
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((name, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`p-3 rounded-lg font-semibold transition-all duration-200 text-center ${
                days.includes(idx)
                  ? 'bg-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105'
              }`}
              title={fullDayNames[idx]}
            >
              <div className="text-sm">{name}</div>
            </button>
          ))}
        </div>
        {days.length === 0 && (
          <p className="text-xs text-yellow-400 mt-2">Select at least one day</p>
        )}
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-2 block">Time</label>
        <input
          type="time"
          value={config.time || '09:00'}
          onChange={(e) => onChange({ ...config, time: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">
          Runs on selected days at this time
          {days.length > 0 && ` (${days.map(d => dayNames[d]).join(', ')})`}
        </p>
      </div>
    </div>
  )
}

// Monthly configuration component
function MonthlyConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  return (
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-indigo-400" />
        <label className="form-label mb-0">Monthly Schedule</label>
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-2 block">Day of Month</label>
        <input
          type="number"
          min="1"
          max="31"
          value={config.day || 1}
          onChange={(e) => onChange({ ...config, day: parseInt(e.target.value) })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">
          Day 1-31. For months with fewer days, the last day will be used.
        </p>
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-2 block">Time</label>
        <input
          type="time"
          value={config.time || '09:00'}
          onChange={(e) => onChange({ ...config, time: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">
          Runs on the {config.day || 1}{config.day === 1 ? 'st' : config.day === 2 ? 'nd' : config.day === 3 ? 'rd' : 'th'} of each month
        </p>
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

  const examples = [
    { expression: '0 9 * * *', description: 'Every day at 9:00 AM' },
    { expression: '0 9 * * 1-5', description: 'Weekdays at 9:00 AM' },
    { expression: '0 */6 * * *', description: 'Every 6 hours' },
    { expression: '0 0 1 * *', description: 'First day of month at midnight' },
    { expression: '0 0 * * 0', description: 'Every Sunday at midnight' },
  ]

  return (
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-indigo-400" />
        <label className="form-label mb-0">Custom Cron Expression</label>
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-2 block">Cron Expression</label>
        <input
          type="text"
          value={cronInput}
          onChange={(e) => setCronInput(e.target.value)}
          placeholder="0 9 * * 1-5"
          className={`w-full bg-gray-700 border ${
            isValid ? 'border-gray-600 focus:ring-indigo-500 focus:border-indigo-500' : 'border-red-500 focus:ring-red-500 focus:border-red-500'
          } text-white rounded-lg p-3 focus:ring-2 transition-all`}
        />
        {isValid ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
            <Check className="w-4 h-4" />
            <span>{description}</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
            <Settings className="w-4 h-4" />
            <span>Invalid cron expression. Format: minute hour day month weekday</span>
          </div>
        )}
      </div>

      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-medium text-gray-300">Common Examples:</p>
        </div>
        <div className="space-y-2">
          {examples.map((example, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCronInput(example.expression)}
              className="w-full text-left p-2 rounded-md hover:bg-gray-800/70 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <code className="text-indigo-400 text-sm font-mono">{example.expression}</code>
                <span className="text-gray-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Click to use</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">{example.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <p className="text-xs text-gray-500">
            Format: <code className="text-indigo-400">minute hour day month weekday</code><br />
            Use * for any, - for ranges, / for steps, , for lists
          </p>
        </div>
      </div>
    </div>
  )
}