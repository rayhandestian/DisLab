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
  const [isTestMode, setIsTestMode] = useState(false)

  // Embed data structure
  interface EmbedData {
    title?: string
    description?: string
    color?: number
    author?: { name: string; url?: string; icon_url?: string }
    fields?: Array<{ name: string; value: string; inline?: boolean }>
  }

  interface WebhookPayload {
    content?: string
    username?: string
    avatar_url?: string
    thread_name?: string
    embeds?: EmbedData[]
    flags?: number
  }

  const [embedData, setEmbedData] = useState<EmbedData[]>([{}])

  // Flags
  const [suppressEmbeds, setSuppressEmbeds] = useState(false)
  const [suppressNotifications, setSuppressNotifications] = useState(false)

  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message)
    setTimeout(() => setStatusMessage(''), 5000)
  }

  const clearWebhook = () => {
    setWebhookUrl('')
    localStorage.removeItem('discordWebhookUrl')
  }

  const sendWebhook = async (isTest = false) => {
    if (!webhookUrl) {
      showStatus('Please enter a webhook URL', true)
      return
    }

    if (!isTest && !message && embedData.length === 0) {
      showStatus('Please enter a message or add an embed', true)
      return
    }

    setIsLoading(true)
    try {
      const payload: WebhookPayload = {
        username: username || undefined,
        avatar_url: avatarUrl || undefined,
        thread_name: threadName || undefined,
      }

      if (isTest) {
        payload.content = 'This is a test message from DisLab.'
      } else {
        payload.content = message || undefined
      }

      // Add embeds if any
      const validEmbeds = embedData.filter(embed =>
        embed.title || embed.description || embed.author?.name
      )
      if (validEmbeds.length > 0) {
        payload.embeds = validEmbeds
      }

      // Add flags
      let flags = 0
      if (suppressEmbeds) flags |= (1 << 2)
      if (suppressNotifications) flags |= (1 << 12)
      if (flags > 0) payload.flags = flags

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        showStatus(isTest ? 'Test message sent!' : 'Webhook sent successfully!')
        if (!isTest) {
          // Reset form
          setMessage('')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        showStatus(`Error: ${errorData.message || 'Failed to send webhook'}`, true)
      }
    } catch (error) {
      showStatus('Network error - check your connection', true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles)

    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0)
    if (totalSize > 25 * 1024 * 1024) {
      showStatus('Total file size exceeds 25 MB!', true)
    }
  }

  // Save webhook URL to localStorage
  useEffect(() => {
    if (webhookUrl) {
      localStorage.setItem('discordWebhookUrl', webhookUrl)
    }
  }, [webhookUrl])

  // Load saved webhook URL
  useEffect(() => {
    const saved = localStorage.getItem('discordWebhookUrl')
    if (saved) setWebhookUrl(saved)
  }, [])

  // Collapsible sections
  const toggleSection = (button: HTMLElement) => {
    const content = button.nextElementSibling as HTMLElement
    button.classList.toggle('open')
    content.classList.toggle('open')
  }

  useEffect(() => {
    const toggles = document.querySelectorAll('.section-toggle')
    toggles.forEach(button => {
      button.addEventListener('click', () => toggleSection(button as HTMLElement))
    })
    return () => {
      toggles.forEach(button => {
        button.removeEventListener('click', () => toggleSection(button as HTMLElement))
      })
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <style jsx>{`
        .section-toggle .chevron {
          transition: transform 0.2s ease-in-out;
        }
        .section-toggle.open .chevron {
          transform: rotate(180deg);
        }
        .section-content {
          transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
          overflow: hidden;
          max-height: 0;
          opacity: 0;
        }
        .section-content.open {
          max-height: 5000px;
          opacity: 1;
        }
        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #e2e8f0;
        }
        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #a0aec0;
          margin-bottom: 0.5rem;
        }
        .form-hint {
          font-size: 0.75rem;
          color: #718096;
          margin-top: 0.25rem;
        }
      `}</style>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="Enter your Discord webhook URL"
                    className="flex-grow bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                  />
                  <button
                    type="button"
                    onClick={clearWebhook}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-150 shadow-md"
                  >
                    Clear
                  </button>
                </div>
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

              {/* Optional Settings */}
              <div className="border-b border-gray-700 py-2">
                <button type="button" className="w-full flex justify-between items-center text-left section-toggle">
                  <h2 className="section-title">Optional Settings</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
                <div className="section-content mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Forum Thread Name</label>
                      <input
                        type="text"
                        value={threadName}
                        onChange={(e) => setThreadName(e.target.value)}
                        placeholder="New Thread Title"
                        maxLength={100}
                        className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                      />
                      <p className="form-hint">Max 100 characters.</p>
                    </div>
                    <div>
                      <label className="form-label">Attach Files</label>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                      />
                      <div className="form-hint">
                        {files.length > 0
                          ? `${files.length} file(s) selected. Total size: ${(files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB.`
                          : 'Max total size: 25 MB.'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Embeds */}
              <div className="border-b border-gray-700 py-2">
                <button type="button" className="w-full flex justify-between items-center text-left section-toggle">
                  <h2 className="section-title">Embeds</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
                <div className="section-content mt-4">
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-700 pb-2">
                    <div className="flex-grow flex items-center gap-1 overflow-x-auto pb-1">
                      <button
                        type="button"
                        className="text-sm font-semibold py-1 px-3 rounded-md bg-indigo-600 text-white"
                      >
                        Embed 1
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-md transition duration-150 shadow-md whitespace-nowrap"
                    >
                      + Add Embed
                    </button>
                  </div>

                  {/* Embed Author */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-300">Author</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      <div>
                        <label className="form-label">Author Name</label>
                        <input
                          type="text"
                          placeholder="e.g., Jane Doe"
                          maxLength={256}
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                        <p className="form-hint">Max 256 chars.</p>
                      </div>
                      <div>
                        <label className="form-label">Author URL</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="form-label">Author Icon URL</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Embed Body */}
                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-gray-300">Body</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="form-label">Title</label>
                        <input
                          type="text"
                          placeholder="e.g., Weekly Report"
                          maxLength={256}
                          className="bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500 w-full"
                        />
                        <p className="form-hint">Max 256 chars.</p>
                      </div>
                      <div>
                        <label className="form-label">Title URL</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500 w-full"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="form-label">Description</label>
                        <textarea
                          rows={5}
                          placeholder="Supports Markdown..."
                          maxLength={4096}
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                        <p className="form-hint">Max 4096 chars.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="form-label mb-0">Color</label>
                        <input
                          type="color"
                          defaultValue="#5865F2"
                          className="p-1 h-10 w-10 block bg-gray-700 border border-gray-600 cursor-pointer rounded-lg"
                        />
                        <input
                          type="text"
                          defaultValue="#5865F2"
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Embed Images */}
                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-gray-300">Images</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="form-label">Image URL</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="form-label">Thumbnail URL</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Embed Footer */}
                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-gray-300">Footer</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="form-label">Footer Text</label>
                        <input
                          type="text"
                          placeholder="e.g., Status: OK"
                          maxLength={2048}
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                        <p className="form-hint">Max 2048 chars.</p>
                      </div>
                      <div>
                        <label className="form-label">Footer Icon URL</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label className="ml-2 text-sm text-gray-300">Enable Custom Timestamp</label>
                        </div>
                        <div className="hidden">
                          <label className="form-label">Timestamp</label>
                          <input
                            type="datetime-local"
                            className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500 text-gray-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Embed Fields */}
                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-gray-300">Fields</h3>
                    <button
                      type="button"
                      className="mt-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150 shadow-md"
                    >
                      + Add Field
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced */}
              <div className="py-2">
                <button type="button" className="w-full flex justify-between items-center text-left section-toggle">
                  <h2 className="section-title">Advanced</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
                <div className="section-content mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">Flags</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={suppressEmbeds}
                          onChange={(e) => setSuppressEmbeds(e.target.checked)}
                          className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="text-sm text-gray-300">Suppress Embeds</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={suppressNotifications}
                          onChange={(e) => setSuppressNotifications(e.target.checked)}
                          className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="text-sm text-gray-300">Suppress Notifications</label>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">Message Link</h3>
                      <p className="form-hint mb-2">Editing/loading messages requires bot functionality not available to webhooks.</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Discord message URL (feature disabled)"
                          className="flex-grow bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                          disabled
                        />
                        <button
                          type="button"
                          className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg cursor-not-allowed"
                          disabled
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-700">
              <button
                onClick={() => sendWebhook(false)}
                disabled={isLoading}
                className="w-full sm:w-auto flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-150 shadow-md"
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </button>
              <button
                onClick={() => sendWebhook(true)}
                disabled={isLoading}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition duration-150 shadow-md"
              >
                Test
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