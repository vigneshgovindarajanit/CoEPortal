import { useEffect, useState } from 'react'

export default function useExam(loader, initialValue = []) {
  const [data, setData] = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      if (typeof loader !== 'function') {
        return
      }

      setLoading(true)
      setError('')

      try {
        const result = await loader()
        if (active) {
          setData(result)
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load exam data')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [loader])

  return { data, loading, error, setData }
}
