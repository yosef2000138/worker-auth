import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 5,
    fields: 20,
    fieldNameSize: 100,
  },
  fileFilter: (_, file, callback) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      callback(null, true);
      return;
    }
    callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

export function hasImageSignature(buffer: Buffer) {
  const isJpeg = buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
  const isPng = buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = buffer.length >= 6
    && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const isoBrand = buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    ? buffer.subarray(8, 12).toString('ascii')
    : '';
  const isHeif = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(isoBrand);

  return isJpeg || isPng || isGif || isWebp || isHeif;
}

export function validateUploadedImages(req: Request, _res: Response, next: NextFunction) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.every(file => hasImageSignature(file.buffer))) {
    next();
    return;
  }

  next({
    status: 422,
    code: 'INVALID_IMAGE_FILE',
    message: 'One or more uploaded files are not valid supported images.',
  });
}
