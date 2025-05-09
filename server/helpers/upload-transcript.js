// helpers/upload-transcript.js
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsCredentials } from '../../config.js';

const s3Client = new S3Client({
  region: awsCredentials.tmpAwsRegion,
  credentials: {
    accessKeyId: awsCredentials.tmpAwsAccessKey,
    secretAccessKey: awsCredentials.tmpAwsSecretAccessKey,
  },
});

export async function uploadTranscriptViaPresignedUrl(filePath) {
  const fileStream = fs.readFileSync(filePath);

  const relativePath = filePath.split('meeting_transcripts')[1];
  const key = `meeting_transcripts${relativePath.replace(/\\/g, '/')}`;

  const command = new PutObjectCommand({
    Bucket: awsCredentials.tmpS3BucketName,
    Key: key,
    ContentType: 'text/plain',
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: fileStream,
  });

  if (!uploadRes.ok) {
    const error = await uploadRes.text();
    throw new Error(`Upload failed: ${error}`);
  }

  console.log(`✅ Uploaded to S3 at: ${key}`);
  return key;
}
