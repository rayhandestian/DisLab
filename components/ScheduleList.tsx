'use client'

import { useEffect, useState } from 'react'
import { useSupabase, useUser } from '@/hooks/useSupabase'
import toast from 'react-hot-toast'

interface Schedule {
  id: string
  name: string
  schedule_time: string
  is_active: boolean
  created_at: string
}

export default function ScheduleList({ refresh }: { refresh?: number }) {
  const supabase = useSupabase()
  const { user } = useUser()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchSchedules()
    }
  }, [user, refresh])

  const fetchSchedules = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching schedules:', error)
    } else {
      setSchedules(data || [])
    }
    setLoading(false)
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Error deleting schedule')
    } else {
      toast.success('Schedule deleted successfully')
      fetchSchedules()
    }
  }

  if (loading) {
    return <div className="text-gray-300 animate-pulse">Loading schedules...</div>
  }

  if (schedules.length === 0) {
    return <div className="text-gray-300 text-center py-8">No schedules yet. Create your first one above!</div>
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="glass-card p-4 interactive-card">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-white">{schedule.name}</h3>
              <p className="text-gray-300 text-sm">
                Scheduled for: {new Date(schedule.schedule_time).toLocaleString()}
              </p>
              <p className="text-gray-300 text-sm">
                Status: <span className={schedule.is_active ? 'text-green-400' : 'text-gray-400'}>{schedule.is_active ? 'Active' : 'Sent'}</span>
              </p>
            </div>
            <button
              onClick={() => deleteSchedule(schedule.id)}
              className="neumorph px-3 py-1 rounded text-sm text-red-300 hover:text-red-200 transition-all duration-300 transform hover:scale-105"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}