import path from 'path'
import cors from 'cors'
import express from 'express'
import router from './router.mjs'

const PORT = 8888
const app = express()

app.use(cors())

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/assets/index.html'))
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(router)


app.listen(PORT, () => {
  console.log('Upload service running on', PORT)
})