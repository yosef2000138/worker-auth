import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export { cloudinary };

export type UploadedAsset = {
  url: string;
  publicId: string;
};

/** Stream a buffer directly to Cloudinary and retain its deletion identifier. */
export function uploadBuffer(
  buffer: Buffer,
  folder: string,
): Promise<UploadedAsset> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteUploadedAsset(asset: UploadedAsset) {
  await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: 'image',
    invalidate: true,
  });
}
