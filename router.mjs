import { fileURLToPath } from 'url'
import path, { dirname } from 'path'
import got from 'got'
import express from 'express'
import multer from 'multer'
import { google } from 'googleapis'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const router = express.Router()
const upload = multer()
const drive = google.drive('v2')

const CHUNK_SIZE = 1024 * 1024 * 3
const statuses = {}

function* chunkify(buffer, chunkSize = CHUNK_SIZE) {
  for (let pos = 0; pos < buffer.byteLength; pos += chunkSize) {
    yield buffer.subarray(pos, pos + chunkSize)
  }
}

async function getLocation (filename, content, mimeType, filesize, folderId) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, './keys-service.json'),
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata'
      ],
    });
    
    google.options({ auth })
  
    const urlResumable = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'
    
    const initial = await auth.request({
      url: urlResumable,
      method: 'POST',
      data: {
        mimeType,
        name: filename,
        parents: [folderId],
      }
    })
    const location = initial.headers.location
  
    return location
  } catch (e) {
    console.error(e)
  }
}

router.get('/oauth2callback', async (req, res) => {
  try {
    res.end('Authentication successful! Please return to the console.');
  } catch (e) {
    reject(e);
  }
})

router.get('/status/:id', async (req, res) => {
  try {
    const status = statuses[req.params.id]

    if (status) {
      res.status(200).send(status)
      if (status.percent === 1) {
        delete statuses[req.params.id]
      }
    }
  } catch (e) {
    console.error(e)
    res.status(500).send(e.message)
  }
})

router.post('/upload', upload.any(), async (req, res) => {
  try {
    const { files } = req
    const folderId = req.get('folderId')
    const file = files[0]
    const location = await getLocation(file.originalname, file.buffer, file.mimetype, file.size, folderId)  
    const url = new URLSearchParams(location)
    const uploadId = url.get('upload_id')
    const upload = () => new Promise((resolve, reject) => {
      const stream = got.stream(location, {
        method: 'PUT',
        body: chunkify(file.buffer), 
        headers: {
          'Content-Length': file.size
        },
      })
  
      stream.resume()
  
      stream.on('uploadProgress', progress => {
        console.log(`PROGRESS`, progress)
        statuses[uploadId] = progress
      })

      resolve(true)
  
      stream.on('response', response => {
        try {
          console.log('finish upload')
        } catch (e) {
          console.error(e)
        }
      })
    })
  
    upload()
  
    res.status(200).send(uploadId)
  } catch (e) {
    console.error(e)
    res.status(500).send(e.message)
  }
})

export default router 