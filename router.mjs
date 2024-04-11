import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import got from 'got';
import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();
const upload = multer();
const drive = google.drive('v2');

const CHUNK_SIZE = 1024 * 1024 * 3;
const statuses = {};

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

function processAudio(fileBuffer) {
  return new Promise((resolve, reject) => {
    const readableStream = new Readable();
    readableStream._read = () => {};
    readableStream.push(fileBuffer);
    readableStream.push(null); // Indicates the end of the stream

    let processedBuffer = [];
    ffmpeg(readableStream)
      .audioFilter('asetrate=44100*1.25,aresample=44100') // Example of increasing pitch
      .format('mp3')
      .on('error', (err) => reject(err))
      .on('data', (chunk) => processedBuffer.push(chunk))
      .on('end', () => resolve(Buffer.concat(processedBuffer)))
      .pipe();
  });
}

router.post('/upload', upload.any(), async (req, res) => {
  try {
    const { files } = req;
    const folderId = req.get('folderId');
    const file = files[0];

    let fileBuffer = file.buffer;
    // Check if the file is an m4a file
    if (file.mimetype === 'audio/mp4' || file.originalname.endsWith('.m4a')) {
      console.log('Processing m4a file for pitch adjustment');
      fileBuffer = await processAudio(file.buffer);
    }

    if (folderId) {
      const location = await getLocation(file.originalname, fileBuffer, file.mimetype, fileBuffer.length, folderId);
      const uploadId = new URLSearchParams(location).get('upload_id');
      const upload = () => new Promise((resolve, reject) => {
        const stream = got.stream(location, {
          method: 'PUT',
          body: chunkify(fileBuffer),
          headers: {
            'Content-Length': fileBuffer.length,
          },
        });

        stream.resume();

        stream.on('uploadProgress', (progress) => {
          console.log(`PROGRESS`, progress);
          statuses[uploadId] = progress;
        });

        stream.on('response', () => {
          console.log('Finish upload');
          resolve(uploadId);
        });
      });

      await upload();
      res.status(200).send(uploadId);
    } else {
      res.status(400).send('Folder ID is required');
    }
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

export default router;