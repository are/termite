#!/usr/bin/env node
import React from 'react'

import { App } from './App.js'
import { withFullscreen } from './components/Fullscreen.js'

await withFullscreen(<App />)
