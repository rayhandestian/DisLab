'use client'

import { useState, useEffect } from 'react'

export default function WebhookPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [message, setMessage] = useState('')
  const [threadName, setThreadName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [embeds, setEmbeds] = useState([{}])
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Embed data structure
  interface EmbedData {
    title?: string
    description?: string
    color?: number
    author?: { name: string; url?: string; icon_url?: string }
    fields?: Array<{ name: string; value: string; inline?: boolean }>
  }

  const [embedData, setEmbedData] = useState<EmbedData[]>([{}])

  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message)
    // In a real app, you'd handle the styling and timeout
  }

  const sendWebhook = async () => {
    if (!webhookUrl || !message) {
      showStatus('Please fill in webhook URL and message', true)
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        content: message,
        username: username || undefined,
        avatar_url: avatarUrl || undefined,
        thread_name: threadName || undefined,
        embeds: embedData.filter(embed => embed.title || embed.description)
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        showStatus('Webhook sent successfully!')
        // Reset form
        setMessage('')
        setEmbeds([{}])
        setEmbedData([{}])
      } else {
        showStatus('Failed to send webhook', true)
      }
    } catch (error) {
      showStatus('Error sending webhook', true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex flex-col lg:flex-row gap-8">
        {/* Form */}
        <div className="lg:w-3/5 w-full">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-indigo-400">Discord Webhook Sender</h1>
              <p className="text-gray-400 mt-2">Send messages via Discord webhooks instantly</p>
            </div>

            <div className="space-y-4">
              {/* Webhook URL */}
              <div className="border-b border-gray-700 pb-4">
                <label className="form-label">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="Enter your Discord webhook URL"
                  className="flex-grow bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                />
              </div>

              {/* Profile */}
              <div className="border-b border-gray-700 py-2">
                <h2 className="section-title">Profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="form-label">Username (Optional)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Custom Bot Name"
                      maxLength={80}
                      className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                    />
                  </div>
                  <div>
                    <label className="form-label">Avatar URL (Optional)</label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://i.imgur.com/..."
                      className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="border-b border-gray-700 py-2">
                <h2 className="section-title">Content</h2>
                <label className="form-label">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message here..."
                  maxLength={2000}
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                />
                <p className="form-hint">Max 2000 characters. Supports Markdown.</p>
              </div>

              {/* Thread Name */}
              <div className="border-b border-gray-700 py-2">
                <label className="form-label">Forum Thread Name (Optional)</label>
                <input
                  type="text"
                  value={threadName}
                  onChange={(e) => setThreadName(e.target.value)}
                  placeholder="New Thread Title"
                  maxLength={100}
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                />
              </div>

              {/* Embeds - Simplified for now */}
              <div className="py-2">
                <h2 className="section-title">Embeds (Coming Soon)</h2>
                <p className="text-gray-400">Embed support will be added in a future update.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-700">
              <button
                onClick={sendWebhook}
                disabled={isLoading}
                className="w-full sm:w-auto flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-150 shadow-md"
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            {statusMessage && (
              <div className="mt-6 text-center text-sm p-3 rounded-lg bg-green-500/20 text-green-400">
                {statusMessage}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="lg:w-2/5 w-full">
          <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8 sticky top-8">
            <h2 className="text-2xl font-bold text-gray-300 mb-4">Live Preview</h2>
            <div className="bg-[#36393F] p-4 rounded-lg min-h-[200px] text-white font-sans text-base leading-relaxed">
              <div className="flex items-start">
                <img
                  src={avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                  className="w-10 h-10 rounded-full mr-4"
                  alt="Avatar"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline">
                    <span className="font-semibold text-white mr-2">{username || 'Bot'}</span>
                    <span className="text-gray-400 text-xs">Just now</span>
                  </div>
                  <div className="text-gray-200 whitespace-pre-wrap">{message || 'Your message will appear here...'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}