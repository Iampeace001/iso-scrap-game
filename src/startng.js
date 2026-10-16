const START_NG = 'https://start.ng'
let framePromise

function connectFrame() {
  framePromise ??= new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.src = `${START_NG}/connect`
    frame.hidden = true
    frame.title = 'start.ng connection'
    frame.onload = () => resolve(frame)
    frame.onerror = reject
    document.body.append(frame)
  })
  return framePromise
}

export async function askStartNg(message, replyType, timeoutMs = 5000) {
  try {
    const frame = await connectFrame()
    return await new Promise(resolve => {
      const requestId = Math.random().toString(36).slice(2)
      const finish = value => {
        clearTimeout(timer)
        window.removeEventListener('message', receive)
        resolve(value)
      }
      const timer = setTimeout(() => finish(null), timeoutMs)
      function receive(event) {
        if (event.origin !== START_NG || event.source !== frame.contentWindow) return
        if (event.data?.type === replyType && event.data.requestId === requestId) finish(event.data)
      }
      window.addEventListener('message', receive)
      frame.contentWindow.postMessage({ ...message, requestId }, START_NG)
    })
  } catch {
    return null
  }
}

export const signInUrl = () => `https://start.ng/?return_to=${encodeURIComponent(location.origin + location.pathname)}`

