'use client'

import { useState, useEffect } from 'react'
import { Clock, Settings, Check, ChevronDown } from 'lucide-react'
import type { RecurrencePattern, RecurrenceConfig } from '@/lib/types/schedule'
import { validateCronExpression, describeCronExpression } from '@/lib/cronParser'

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
  const patternOptions = [
    { value: 'once', label: 'One-time', icon: Clock, description: 'Run once at specified date and time' },
    { value: 'cron', label: 'Cron Schedule', icon: Settings, description: 'Advanced scheduling with cron expressions' },
  ]

  return (
    <div className="space-y-6">
      {/* Pattern Type Selector */}
      <div>
        <label className="form-label flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          Schedule Type
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

      {/* Pattern-Specific Fields */}
      {pattern === 'once' && (
        <OnceConfig config={config} onChange={onConfigChange} />
      )}

      {pattern === 'cron' && (
        <CronConfig config={config} onChange={onConfigChange} />
      )}
    </div>
  )
}

// One-time configuration component
function OnceConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
  return (
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-indigo-400" />
        <label className="form-label mb-0">One-time Schedule</label>
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Date & Time</label>
        <input
          type="datetime-local"
          value={config.datetime || ''}
          onChange={(e) => onChange({ ...config, datetime: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">Select the exact date and time for this one-time execution</p>
      </div>
    </div>
  )
}

// Cron configuration component
function CronConfig({ config, onChange }: { config: RecurrenceConfig, onChange: (c: RecurrenceConfig) => void }) {
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

  const templates = [
    { expression: '0 9 * * *', description: 'Every day at 9:00 AM' },
    { expression: '0 9 * * 1-5', description: 'Weekdays at 9:00 AM' },
    { expression: '0 9 * * 0,6', description: 'Weekends at 9:00 AM' },
    { expression: '0 */6 * * *', description: 'Every 6 hours' },
    { expression: '0 0 1 * *', description: 'First day of month at midnight' },
    { expression: '0 0 * * 0', description: 'Every Sunday at midnight' },
    { expression: '*/30 * * * *', description: 'Every 30 minutes' },
    { expression: '0 8-18 * * *', description: 'Every hour from 8 AM to 6 PM' },
  ]

  return (
    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-indigo-400" />
        <label className="form-label mb-0">Cron Expression</label>
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-medium text-gray-300">Templates:</p>
          </div>
          <button
            type="button"
            onClick={() => setCronInput('')}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Clear
          </button>
        </div>
        <div className="grid gap-2 max-h-48 overflow-y-auto">
          {templates.map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCronInput(template.expression)}
              className="w-full text-left p-2 rounded-md hover:bg-gray-800/70 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <code className="text-indigo-400 text-sm font-mono">{template.expression}</code>
                <span className="text-gray-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Use</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">{template.description}</p>
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