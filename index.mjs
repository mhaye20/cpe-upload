import cors from 'cors'
import express from 'express'
import router from './router.mjs'
import { fileURLToPath } from 'url'
import path, { dirname } from 'path'

const PORT = 8888
const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.use(cors())
app.use(router)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/assets/index.html'))
})

app.listen(PORT, () => {
  console.log('Upload service running on', PORT)
})