import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Box, Spacer, Text, useFocusManager, useInput } from 'ink'
import TextInput from 'ink-text-input'

import { writeFile, readFile } from 'fs/promises'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

import { useDimentions } from './components/Fullscreen.js'

enum FocusTarget {
  commandBuffer = 'commandBuffer',
  screenBuffer = 'screenBuffer',
}

enum EditMode {
  replace,
  append,
  writing,
}

async function handleCommand(input: string, screenBuffer: string[]): Promise<string[] | false> {
  const [cmd, ...params] = input.trim().slice(1).split(' ')

  switch (cmd) {
    case 'save': {
      const [file] = params

      await writeFile(`./${file}`, screenBuffer.join('\n'))

      return screenBuffer
    }
    case 'load': {
      const [file] = params

      const content = await readFile(`./${file}`, 'utf-8')

      return content.split('\n')
    }
    case 'write': {
      const handle = params.join(' ')

      await pipeline(Readable.from([screenBuffer.join('\n')], { encoding: 'utf-8' }), createWriteStream(handle))

      return screenBuffer
    }
    default:
      return false
  }
}

export function App() {
  const [columns, rows] = useDimentions()

  const [focus, setFocus] = useState<FocusTarget>(FocusTarget.commandBuffer)

  const [commandBuffer, setCommandBuffer] = useState('')
  const [screenBuffer, setScreenBuffer] = useState<string[]>([])

  const [index, setIndex] = useState(screenBuffer.length - 1)
  const [bounds, setBounds] = useState<[number, number]>([0, Math.min(rows - 3, Math.max(0, screenBuffer.length - 1))])

  const [editMode, setEditMode] = useState<EditMode>(EditMode.writing)

  const handleCommandSubmit = useCallback(
    async (value: string) => {
      if (value.trim().startsWith('/')) {
        // this is a non outputing command
        const result = await handleCommand(value, screenBuffer)

        if (result !== false) {
          setScreenBuffer(result)
          setCommandBuffer('')
        }

        return
      }

      setCommandBuffer('')

      if (editMode === EditMode.replace) {
        setScreenBuffer((buffer) => [...buffer.slice(0, index), value, ...buffer.slice(index + 1)])
        setIndex(index)
        setEditMode(EditMode.append)
        setFocus(FocusTarget.screenBuffer)
      } else if (editMode === EditMode.append) {
        setScreenBuffer((buffer) => [...buffer.slice(0, index + 1), value, ...buffer.slice(index + 1)])
        setIndex(index + 1)
        setEditMode(EditMode.append)
        setFocus(FocusTarget.screenBuffer)
      } else if (editMode === EditMode.writing) {
        setScreenBuffer((buffer) => [...buffer.slice(0, index + 1), value, ...buffer.slice(index + 1)])
        setIndex(index + 1)
      }
    },
    [screenBuffer, index, editMode]
  )

  useLayoutEffect(() => {
    if (index < 0) {
      setIndex(0)
    }

    if (screenBuffer.length >= 1 && index >= screenBuffer.length) {
      setIndex(screenBuffer.length - 1)
    }
  }, [index, screenBuffer])

  useLayoutEffect(() => {
    let maxSize = rows - 3
    const [prevMin, prevMax] = bounds
    let [currMin, currMax] = bounds

    const currSize = currMax - currMin

    if (index < currMin) {
      currMin = index
      currMax = Math.min(screenBuffer.length - 1, currMin + Math.min(maxSize, screenBuffer.length))
    } else if (index > currMax) {
      currMax = index
      currMin = Math.max(0, currMax - Math.min(maxSize, screenBuffer.length))
    } else if (currSize < Math.min(maxSize, screenBuffer.length)) {
      currMax += 2
    }

    if (currMin !== prevMin || currMax !== prevMax) {
      setBounds([currMin, currMax])
    }
  }, [index, screenBuffer, bounds, rows])

  const screenOutput = useMemo(() => {
    return screenBuffer.slice(bounds[0], bounds[1] + 1).map((content, i) => {
      return { lineNumber: i + bounds[0], active: bounds[0] + i === index, content: content }
    })
  }, [bounds, index, screenBuffer])

  useInput((input, key) => {
    if (key.escape) {
      setFocus(FocusTarget.screenBuffer)
    }

    if (focus === FocusTarget.commandBuffer) {
      if (key.upArrow) {
        setIndex(screenBuffer.length - 1)
        setFocus(FocusTarget.screenBuffer)
      }

      if (key.downArrow) {
        setIndex(0)
        setFocus(FocusTarget.screenBuffer)
      }
    }

    if (focus === FocusTarget.screenBuffer) {
      if (key.upArrow) {
        setIndex((index) => Math.min(Math.max(0, index - 1), Math.max(0, screenBuffer.length - 1)))
      }

      if (key.downArrow) {
        setIndex((index) => Math.min(Math.max(0, index + 1), Math.max(0, screenBuffer.length - 1)))
      }

      if (key.return) {
        setEditMode(EditMode.writing)
        setFocus(FocusTarget.commandBuffer)
      }

      if (input === 'r') {
        setEditMode(EditMode.replace)
        setFocus(FocusTarget.commandBuffer)
      }

      if (input === 'a') {
        setEditMode(EditMode.append)
        setFocus(FocusTarget.commandBuffer)
      }

      if (input === 'x') {
        setScreenBuffer((buffer) => [...buffer.slice(0, index), ...buffer.slice(index + 1)])
      }

      if (input === 'n') {
        setScreenBuffer((buffer) => [...buffer.slice(0, index + 1), '', ...buffer.slice(index + 1)])
      }
    }
  })

  return (
    <Box width="100%" height="100%">
      <Box
        borderStyle="single"
        width={8}
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        flexGrow={0}
        flexDirection="column"
      >
        <Box flexGrow={1} flexDirection="column" alignItems="flex-end">
          {screenOutput.map((output) => (
            <Text
              bold={output.active && focus !== FocusTarget.screenBuffer}
              inverse={output.active && focus === FocusTarget.screenBuffer}
            >
              {String(output.lineNumber + 1).padStart(6, ' ') + ' '}
            </Text>
          ))}
        </Box>
        <Box
          flexGrow={0}
          flexDirection="column"
          alignItems="flex-end"
          borderStyle="single"
          borderBottom={false}
          borderRight={false}
          borderLeft={false}
        >
          <Text inverse={focus === FocusTarget.commandBuffer}>
            {(commandBuffer.trim().startsWith('/')
              ? 'CMD'
              : editMode === EditMode.replace
              ? `${index + 1}`
              : ``
            ).padStart(6, ' ') + ' '}
          </Text>
        </Box>
      </Box>

      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <Box flexDirection="column" flexGrow={1}>
          {screenOutput.map((output) => (
            <Text wrap="truncate-end">{output.content.length > 0 ? output.content : ' '}</Text>
          ))}
        </Box>

        <Box flexGrow={0} height={2} borderStyle="single" borderBottom={false} borderRight={false} borderLeft={false}>
          <TextInput
            value={commandBuffer}
            onChange={setCommandBuffer}
            focus={focus === FocusTarget.commandBuffer}
            onSubmit={handleCommandSubmit}
          />
        </Box>
      </Box>
    </Box>
  )
}

/*

      <Box flexGrow={1}>
        <Box width={10}></Box>
        <Box borderStyle="single" borderTop={false} borderRight={false}>
          <Text>{screenBuffer}</Text>
        </Box>
      </Box>

      <Box flexShrink={1} flexGrow={0} height={1} flexDirection="row">
        <Box paddingX={1} borderStyle="single" width={10} borderTop={false} borderBottom={false} borderLeft={false}>
          <Text>COMMAND</Text>
        </Box>

        <Box>

        </Box>
      </Box>

*/
