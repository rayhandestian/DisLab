'use client'

import { useState, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'

type TimezoneSelectorProps = {
  value?: string
  onChange: (timezone: string) => void
}

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC', offset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time', offset: 'EST/EDT' },
  { value: 'America/Chicago', label: 'Central Time', offset: 'CST/CDT' },
  { value: 'America/Denver', label: 'Mountain Time', offset: 'MST/MDT' },
  { value: 'America/Los_Angeles', label: 'Pacific Time', offset: 'PST/PDT' },
  { value: 'Europe/London', label: 'London', offset: 'GMT/BST' },
  { value: 'Europe/Paris', label: 'Paris', offset: 'CET/CEST' },
  { value: 'Europe/Berlin', label: 'Berlin', offset: 'CET/CEST' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'Shanghai', offset: '+08:00' },
  { value: 'Asia/Kolkata', label: 'India', offset: '+05:30' },
  { value: 'Asia/Jakarta', label: 'Jakarta', offset: '+07:00' },
  { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
  { value: 'Australia/Sydney', label: 'Sydney', offset: 'AEST/AEDT' },
  { value: 'Pacific/Auckland', label: 'Auckland', offset: 'NZST/NZDT' },
]

export default function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userTimezone, setUserTimezone] = useState<string>('UTC')

  useEffect(() => {
    // Detect user's timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      setUserTimezone(detected)
      if (!value) {
        onChange(detected)
      }
    } catch {
      // Fallback to UTC
      setUserTimezone('UTC')
      if (!value) {
        onChange('UTC')
      }
    }
  }, [])

  const selectedTimezone = COMMON_TIMEZONES.find(tz => tz.value === value) ||
                          COMMON_TIMEZONES.find(tz => tz.value === userTimezone) ||
                          COMMON_TIMEZONES[0]

  const getCurrentTimeInTimezone = (timezone: string) => {
    try {
      return new Date().toLocaleTimeString([], {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '--:--'
    }
  }

  return (
    <div className="relative">
      <label className="form-label flex items-center gap-2">
        <Globe className="w-4 h-4 text-indigo-400" />
        Time Zone
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
            {selectedTimezone.offset.split('/')[0].replace(/[^+\-\d]/g, '').slice(0, 3) || 'UTC'}
          </div>
          <div>
            <div className="font-medium">{selectedTimezone.label}</div>
            <div className="text-sm text-gray-400">
              {selectedTimezone.offset} • {getCurrentTimeInTimezone(selectedTimezone.value)}
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {COMMON_TIMEZONES.map((timezone) => (
            <button
              key={timezone.value}
              type="button"
              onClick={() => {
                onChange(timezone.value)
                setIsOpen(false)
              }}
              className={`w-full p-3 text-left hover:bg-gray-700 transition-colors flex items-center justify-between ${
                value === timezone.value ? 'bg-indigo-600/20' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {timezone.offset.split('/')[0].replace(/[^+\-\d]/g, '').slice(0, 3) || 'UTC'}
                </div>
                <div>
                  <div className="font-medium text-white">{timezone.label}</div>
                  <div className="text-sm text-gray-400">
                    {timezone.offset} • {getCurrentTimeInTimezone(timezone.value)}
                  </div>
                </div>
              </div>
              {value === timezone.value && (
                <Check className="w-5 h-5 text-indigo-400" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}