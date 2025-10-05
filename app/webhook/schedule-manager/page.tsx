'use client'

import ScheduleManager from '@/components/webhook/ScheduleManager'

export default function ScheduleManagerPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8 fade-in">
          <ScheduleManager />
        </div>
      </div>
    </div>
  )
}