import { useEffect, useState } from 'react'

export default function useTimer(initialSeconds = 0) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(value - 1, 0))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [secondsLeft])

  return { secondsLeft, setSecondsLeft }
}
