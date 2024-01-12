import React, { ReactNode, useState, useEffect } from 'react'
import { Box, useStdout, render } from 'ink'

type FullscreenProps = {
  children: ReactNode
}

export function useDimentions() {
  const { stdout } = useStdout()
  const [dimensions, setDimensions] = useState([stdout.columns, stdout.rows])

  useEffect(() => {
    const handler = () => setDimensions([stdout.columns, stdout.rows])

    stdout.on('resize', handler)

    return () => {
      stdout.off('resize', handler)
    }
  }, [stdout])

  return dimensions
}

export function Fullscreen({ children }: FullscreenProps) {
  const [columns, rows] = useDimentions()

  return (
    <Box height={rows} width={columns}>
      {children}
    </Box>
  )
}

async function write(content: string) {
  return new Promise<void>((resolve, reject) => {
    process.stdout.write(content, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export async function withFullscreen(app: ReactNode) {
  await write('\x1b[?1049h')
  await render(<Fullscreen>{app}</Fullscreen>).waitUntilExit()
  await write('\x1b[?1049l')
}
