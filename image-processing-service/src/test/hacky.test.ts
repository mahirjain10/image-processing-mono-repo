/*
 * Load Testing Script with Per-Queue Metrics + Result Verification + Cumulative Metrics
 *
 * Features:
 * - Equal job distribution across queues
 * - Per-queue success/failure + percentiles
 * - CONVERT flips PNG <-> JPEG (avoids converting same->same)
 * - Verifies final image via publicUrl from SSE (format, size)
 * - Prints cumulative metrics across all queues (avg/min/max/P50/P75/P90/P95/P99)
 *
 * USAGE:
 * 1. npm install eventsource (if SSE client lib used elsewhere)
 * 2. ts-node hacky.test.updated.ts <num-jobs>
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

// ##################################################################
// CONFIGURATION
// ##################################################################
const CONFIG = {
  API_BASE_URL: 'http://localhost:5000',
  SSE_UPDATES_URL: 'http://localhost:5000/status',

  USERNAME: 'test@gmail.com',
  PASSWORD: 'mahirjain30@',
  // REQUEST_TIMEOUT_MS: 60000,
  // JOB_COMPLETION_TIMEOUT_MS: 120000,

  // FOR 500 REQUEST
  REQUEST_TIMEOUT_MS: 120000,
  JOB_COMPLETION_TIMEOUT_MS: 300000,

  IMAGE_PATHS: [
    {
      path: 'C:/Users/Mahir/Pictures/moon.jpg',
      contentType: 'image/jpeg',
    },
    {
      path: 'C:\\Users\\Mahir\\Pictures\\twt-pictures\\G0v3ZRpXQAAVAH7.png',
      contentType: 'image/png',
    },
  ],
};
// ##################################################################

// ##################################################################
// API TYPES
// ##################################################################
enum TransformationType {
  ROTATE = 'ROTATE',
  RESIZE = 'RESIZE',
  FORCE_RESIZE = 'FORCE_RESIZE',
  CONVERT = 'CONVERT',
}

enum ProcessingStatus {
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  PROCESSING = 'PROCESSING',
  PENDING = 'PENDING',
}

type RotationDegree = 0 | 90 | 180 | 270;
type SupportedFormat = 'PNG' | 'JPEG' | 'GIF' | 'BMP' | 'TIFF';

type ApiTransformationParams = {
  degree?: RotationDegree;
  width?: number;
  height?: number;
  format?: SupportedFormat;
};

interface UploadUrlPayload {
  filename: string;
  mimeType: string;
  transformationType: TransformationType;
  transformationParamters: ApiTransformationParams;
}

interface ApiResponse {
  statusCode: number | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
  cookies: string[] | undefined;
}

interface UploadUrlResponse {
  message: string;
  data: {
    preSignedUrl: string;
    id: string;
    filename: string;
  };
}

interface SseMessageData {
  jobId: string;
  status: ProcessingStatus;
  type: string;
  userId: string;
  errorMsg: string | null;
  publicUrl?: string;
  outputFilename?: string;
}
// ##################################################################

// Per-queue statistics
interface QueueStats {
  queueName: string;
  totalJobs: number;
  successful: number;
  failed: number;
  verified: number; // successfully verified transformations
  timings: number[]; // ms
  errors: Array<{ job: number; id: string | null; error: string }>;
}

// Pending jobs now store more info for verification
const pendingJobs = new Map<
  string,
  {
    resolve: () => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
    jobNumber: number;
    queueType: TransformationType;
    startTime: number;
    originalContentType: string;
    expectedParams: ApiTransformationParams;
  }
>();

const queueStats = new Map<TransformationType, QueueStats>();

function initializeQueueStats() {
  const queues = Object.values(TransformationType);
  queues.forEach((queue) => {
    queueStats.set(queue, {
      queueName: queue,
      totalJobs: 0,
      successful: 0,
      failed: 0,
      verified: 0,
      timings: [],
      errors: [],
    });
  });
}

const globalStats = {
  totalJobs: 0,
  successful: 0,
  failed: 0,
  startTime: null as number | null,
  endTime: null as null | number,
};

// ##################################################################
// HTTP HELPERS
// ##################################################################
function makeRequest(
  url: string,
  options: http.RequestOptions = {},
  body: string | null = null,
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
      ...options,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          cookies: res.headers['set-cookie'],
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout: ${options.method || 'GET'} ${url}`));
    });

    if (body) req.write(body);
    req.end();
  });
}

function extractToken(cookies: string[] | undefined): string | null {
  if (!cookies) return null;
  for (const cookie of cookies) {
    const match = cookie.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

function uploadToS3(
  presignedUrl: string,
  filePath: string,
  contentType: string,
): Promise<number> {
  const fileBuffer = fs.readFileSync(filePath);
  const urlObj = new URL(presignedUrl);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'PUT',
        headers: {
          'Content-Length': fileBuffer.length,
          'Content-Type': contentType,
        },
        timeout: CONFIG.REQUEST_TIMEOUT_MS,
      },
      (res) => resolve(res.statusCode || 0),
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('S3 upload timeout'));
    });

    req.write(fileBuffer);
    req.end();
  });
}

// ##################################################################
// TRANSFORMATION LOGIC (FIXED CONVERT)
// ##################################################################
function getTransformationForType(
  type: TransformationType,
  contentType: string,
): Omit<UploadUrlPayload, 'filename' | 'mimeType'> & {
  expectedParams: ApiTransformationParams;
} {
  let params: ApiTransformationParams;

  switch (type) {
    case TransformationType.RESIZE:
      params = { width: 800, height: 600 };
      break;
    case TransformationType.FORCE_RESIZE:
      params = { width: 700, height: 700 };
      break;
    case TransformationType.ROTATE:
      params = { degree: 90 };
      break;
    case TransformationType.CONVERT: {
      // Ensure we convert between different formats only (jpg/jpeg ↔ png)
      const isPng = contentType.toLowerCase().includes('png');
      const isJpeg =
        contentType.toLowerCase().includes('jpeg') ||
        contentType.toLowerCase().includes('jpg');

      if (!isPng && !isJpeg) {
        throw new Error(
          `Unsupported source format for conversion: ${contentType}. Only PNG and JPEG/JPG are supported.`,
        );
      }

      const targetFormat: SupportedFormat = isPng ? 'JPEG' : 'PNG';
      params = { format: targetFormat };

      break;
    }
    default:
      params = {};
  }

  return {
    transformationType: type,
    transformationParamters: params,
    expectedParams: params,
  };
}

// ##################################################################
// IMAGE VERIFICATION (via publicUrl)
// ##################################################################
async function verifyTransformation(
  jobId: string,
  type: TransformationType,
  publicUrl: string,
  originalContentType: string,
  expectedParams: ApiTransformationParams,
): Promise<{ ok: boolean; reason?: string; metadata?: any }> {
  try {
    // 1. HEAD request first (fast)
    const headRes = await makeRequest(publicUrl, { method: 'HEAD' });
    if (headRes.statusCode !== 200) {
      return { ok: false, reason: `URL returned ${headRes.statusCode}` };
    }

    const finalContentType = (
      headRes.headers['content-type'] || ''
    ).toLowerCase();
    const finalExt = path.extname(new URL(publicUrl).pathname).toLowerCase();
    const contentLength = headRes.headers['content-length'];

    // 2. Download image for metadata validation
    const imageRes = await makeRequest(publicUrl);
    if (imageRes.statusCode !== 200) {
      return {
        ok: false,
        reason: `Failed to download image: ${imageRes.statusCode}`,
      };
    }

    const imageBuffer = Buffer.from(imageRes.body, 'binary');
    const metadata = await extractImageMetadata(imageBuffer);

    switch (type) {
      case TransformationType.CONVERT: {
        const wasPng = originalContentType.includes('png');
        const wasJpeg =
          originalContentType.includes('jpeg') ||
          originalContentType.includes('jpg');

        // Verify format conversion
        const actualIsPng =
          finalContentType.includes('png') || finalExt === '.png';
        const actualIsJpeg =
          finalContentType.includes('jpeg') ||
          finalExt === '.jpg' ||
          finalExt === '.jpeg';

        if (wasPng && !actualIsJpeg) {
          return {
            ok: false,
            reason: `Expected JPEG conversion from PNG, got ${finalContentType || finalExt}`,
            metadata,
          };
        }

        if (wasJpeg && !actualIsPng) {
          return {
            ok: false,
            reason: `Expected PNG conversion from JPEG, got ${finalContentType || finalExt}`,
            metadata,
          };
        }

        // Verify image is not corrupted and has valid dimensions
        if (
          !metadata.width ||
          !metadata.height ||
          metadata.width <= 0 ||
          metadata.height <= 0
        ) {
          return {
            ok: false,
            reason: `Invalid image dimensions: ${metadata.width}x${metadata.height}`,
            metadata,
          };
        }

        // Verify file size is reasonable (not empty)
        if (!contentLength || parseInt(contentLength) === 0) {
          return {
            ok: false,
            reason: 'Empty file detected',
            metadata,
          };
        }

        break;
      }

      case TransformationType.RESIZE:
      case TransformationType.FORCE_RESIZE: {
        if (!finalContentType.includes('image/')) {
          return { ok: false, reason: 'Result is not an image', metadata };
        }

        // Verify dimensions exist and are valid
        if (
          !metadata.width ||
          !metadata.height ||
          metadata.width <= 0 ||
          metadata.height <= 0
        ) {
          return {
            ok: false,
            reason: `Invalid image dimensions: ${metadata.width}x${metadata.height}`,
            metadata,
          };
        }
        break;
      }

      case TransformationType.ROTATE:
        // For rotation, just verify the image is valid
        if (
          !metadata.width ||
          !metadata.height ||
          metadata.width <= 0 ||
          metadata.height <= 0
        ) {
          return {
            ok: false,
            reason: `Invalid image dimensions after rotation: ${metadata.width}x${metadata.height}`,
            metadata,
          };
        }
        break;
    }

    return { ok: true, metadata };
  } catch (err: any) {
    return { ok: false, reason: `Verification error: ${err.message}` };
  }
}

// Simple image metadata extraction without external dependencies
async function extractImageMetadata(buffer: Buffer): Promise<any> {
  const metadata: any = { width: null, height: null, format: null };

  // PNG
  if (
    buffer.length > 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    metadata.format = 'PNG';
    if (buffer.length >= 24) {
      metadata.width = buffer.readUInt32BE(16);
      metadata.height = buffer.readUInt32BE(20);
    }
  }
  // JPEG
  else if (
    buffer.length > 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    metadata.format = 'JPEG';
    let i = 4;
    while (i < buffer.length - 2) {
      if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
        if (i + 9 < buffer.length) {
          metadata.height = buffer.readUInt16BE(i + 5);
          metadata.width = buffer.readUInt16BE(i + 7);
          break;
        }
      }
      i++;
    }
  }

  return metadata;
}

// ##################################################################
// LOGIN & UPLOAD URL
// ##################################################################
async function login(): Promise<string> {
  console.log('🔐 Logging in...');
  const body = JSON.stringify({
    email: CONFIG.USERNAME,
    password: CONFIG.PASSWORD,
  });
  const response = await makeRequest(
    `${CONFIG.API_BASE_URL}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
  );

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Login failed: ${response.statusCode} - ${response.body}`);
  }
  const token = extractToken(response.cookies);
  if (!token) throw new Error('No token received');
  console.log('✅ Login successful');
  return token;
}

async function getUploadUrl(token: string, payload: UploadUrlPayload) {
  const body = JSON.stringify(payload);
  const response = await makeRequest(
    `${CONFIG.API_BASE_URL}/upload/url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Cookie: `token=${token}`,
      },
    },
    body,
  );

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(
      `Upload URL failed: ${response.statusCode} - ${response.body}`,
    );
  }

  const data = JSON.parse(response.body) as UploadUrlResponse;
  if (!data.data.preSignedUrl || !data.data.id) {
    throw new Error(`Missing preSignedUrl or id: ${response.body}`);
  }
  return { presignedUrl: data.data.preSignedUrl, id: data.data.id };
}

// ##################################################################
// SSE CLIENT WITH VERIFICATION
// ##################################################################
class CustomSSEClient {
  private url: URL;
  private headers: Record<string, string>;
  private abortController = new AbortController();
  private isRunning = false;

  constructor(url: string, token: string) {
    this.url = new URL(url);
    this.headers = {
      Cookie: `token=${token}`,
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
  }

  async connect(): Promise<void> {
    const urlObj = new URL(this.url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: this.headers,
          signal: this.abortController.signal,
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`SSE HTTP Error: ${res.statusCode}`));
            return;
          }
          console.log('✅ SSE Connection established.');
          this.isRunning = true;
          resolve();

          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data) this.handleMessage(data);
              }
            }
          });
        },
      );

      req.on('error', (err) => {
        if (!this.isRunning) reject(err);
        else console.error('SSE Error:', err);
      });
      req.end();
    });
  }

  private async handleMessage(data: string): Promise<void> {
    let parsed: SseMessageData;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (parsed.type !== 'status' || !parsed.jobId) return;

    const job = pendingJobs.get(parsed.jobId);
    if (!job) return;

    clearTimeout(job.timeout);
    const duration = Date.now() - job.startTime;
    const stats = queueStats.get(job.queueType)!;

    if (parsed.status === ProcessingStatus.PROCESSED) {
      stats.successful++;
      // Record end-to-end timing (upload -> public URL available)
      stats.timings.push(duration);
      globalStats.successful++;

      if (parsed.publicUrl) {
        console.log(
          `✅ Job ${job.jobNumber} [${job.queueType}] → ${parsed.publicUrl.split('?')[0]}`,
        );

        // Verification runs asynchronously without affecting timing metrics
        verifyTransformation(
          parsed.jobId,
          job.queueType,
          parsed.publicUrl,
          job.originalContentType,
          job.expectedParams,
        )
          .then((verification) => {
            if (verification.ok) {
              stats.verified++;
            } else {
              console.warn(
                `⚠️  Verification FAILED (Job ${job.jobNumber}): ${verification.reason}`,
              );
              stats.errors.push({
                job: job.jobNumber,
                id: parsed.jobId,
                error: `Verification failed: ${verification.reason}`,
              });
            }
          })
          .catch((err) => {
            console.error(`Verification error for job ${job.jobNumber}:`, err);
            stats.errors.push({
              job: job.jobNumber,
              id: parsed.jobId,
              error: `Verification error: ${err.message}`,
            });
          });
      }

      job.resolve();
    } else if (parsed.status === ProcessingStatus.FAILED) {
      stats.failed++;
      globalStats.failed++;
      stats.errors.push({
        job: job.jobNumber,
        id: parsed.jobId,
        error: parsed.errorMsg || 'Unknown failure',
      });
      job.reject(new Error(parsed.errorMsg || 'Job failed'));
    }

    if (
      parsed.status === ProcessingStatus.PROCESSED ||
      parsed.status === ProcessingStatus.FAILED
    ) {
      pendingJobs.delete(parsed.jobId);
    }
  }

  close(): void {
    this.abortController.abort();
    this.isRunning = false;
  }
}

function initializeSseListener(token: string): CustomSSEClient {
  console.log(`🎧 Listening for job updates at ${CONFIG.SSE_UPDATES_URL}`);
  const sse = new CustomSSEClient(CONFIG.SSE_UPDATES_URL, token);
  sse.connect().catch(console.error);
  return sse;
}

async function waitForJobSse(
  jobId: string,
  jobNumber: number,
  queueType: TransformationType,
  startTime: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const stats = queueStats.get(queueType)!;
      stats.failed++;
      globalStats.failed++;
      stats.errors.push({
        job: jobNumber,
        id: jobId,
        error: `Timeout after ${CONFIG.JOB_COMPLETION_TIMEOUT_MS / 1000}s`,
      });
      pendingJobs.delete(jobId);
      reject(new Error(`Job ${jobNumber} timed out`));
    }, CONFIG.JOB_COMPLETION_TIMEOUT_MS);

    pendingJobs.set(jobId, {
      resolve,
      reject,
      timeout,
      jobNumber,
      queueType,
      startTime,
      originalContentType: '',
      expectedParams: {},
    } as any); // will be filled in processJob
  });
}

// ##################################################################
// JOB PROCESSING
// ##################################################################
async function processJob(
  token: string,
  jobNumber: number,
  transformationType: TransformationType,
): Promise<void> {
  const jobStartTime = Date.now();
  let jobId: string | null = null;

  try {
    const selectedImage =
      CONFIG.IMAGE_PATHS[Math.floor(Math.random() * CONFIG.IMAGE_PATHS.length)];
    const { path: imagePath, contentType } = selectedImage;
    const extension = path.extname(imagePath);
    const sourceFileName = `test-job-${jobNumber}-${Date.now()}${extension}`;

    // FIXED: No more name collision
    const transform = getTransformationForType(transformationType, contentType);

    const payload: UploadUrlPayload = {
      filename: sourceFileName,
      mimeType: contentType,
      transformationType: transform.transformationType,
      transformationParamters: transform.transformationParamters,
    };

    console.log(
      `📤 Job ${jobNumber} [${transform.transformationType}]: ${path.basename(imagePath)}`,
    );

    const { presignedUrl, id } = await getUploadUrl(token, payload);
    jobId = id;

    // Store verification info
    const pending = pendingJobs.get(jobId);
    if (pending) {
      pending.originalContentType = contentType;
      pending.expectedParams = transform.expectedParams;
    }

    const uploadStatus = await uploadToS3(presignedUrl, imagePath, contentType);
    if (uploadStatus !== 200)
      throw new Error(`S3 upload failed: ${uploadStatus}`);

    console.log(
      `⏳ Job ${jobNumber} [${transform.transformationType}]: Waiting... (ID: ${jobId})`,
    );
    await waitForJobSse(jobId, jobNumber, transformationType, jobStartTime);

    const duration = Date.now() - jobStartTime;
    console.log(
      `✅ Job ${jobNumber} [${transform.transformationType}]: Done in ${duration}ms`,
    );
  } catch (error: any) {
    // basic error logging (keeps script simple)
    console.log(
      `❌ Job ${jobNumber} [${transformationType}] (ID: ${jobId}): ERROR - ${error.message}`,
    );
  }
}

// ##################################################################
// STATS & RESULTS
// ##################################################################
function calculatePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

function printQueueStats(stats: QueueStats) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 QUEUE: ${stats.queueName}`);
  console.log(`${'─'.repeat(60)}`);

  const successRate =
    stats.totalJobs > 0
      ? ((stats.successful / stats.totalJobs) * 100).toFixed(2)
      : '0';
  const verifiedRate =
    stats.successful > 0
      ? ((stats.verified / stats.successful) * 100).toFixed(2)
      : '0';

  console.log(
    `📦 Total: ${stats.totalJobs} | ✅ Success: ${stats.successful} (${successRate}%) | ✅ Verified: ${stats.verified} (${verifiedRate}%)`,
  );
  console.log(`❌ Failed: ${stats.failed}`);

  if (stats.timings.length > 0) {
    const avg = Math.round(
      stats.timings.reduce((a, b) => a + b, 0) / stats.timings.length,
    );

    const minTime = Math.min(...stats.timings);
    const maxTime = Math.max(...stats.timings);

    const p50 = calculatePercentile(stats.timings, 50);
    const p75 = calculatePercentile(stats.timings, 75);
    const p90 = calculatePercentile(stats.timings, 90);
    const p95 = calculatePercentile(stats.timings, 95);
    const p99 = calculatePercentile(stats.timings, 99);

    console.log(
      `\n⏱️  Avg: ${avg}ms | Min: ${minTime}ms | Max: ${maxTime}ms\n   P50: ${p50}ms | P75: ${p75}ms | P90: ${p90}ms | P95: ${p95}ms | P99: ${p99}ms`,
    );
  }

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (${stats.errors.length}):`);
    const map = new Map<string, number>();
    stats.errors.forEach((e) => map.set(e.error, (map.get(e.error) || 0) + 1));
    map.forEach((c, err) => console.log(`   (${c}x) ${err}`));
  }
}

function printCumulativeStats() {
  // gather all timings
  const allTimings: number[] = [];
  queueStats.forEach((s) => allTimings.push(...s.timings));

  if (allTimings.length === 0) return;

  const total = allTimings.length;
  const avg = Math.round(allTimings.reduce((a, b) => a + b, 0) / total);
  const min = Math.min(...allTimings);
  const max = Math.max(...allTimings);

  console.log('\n' + '═'.repeat(60));
  console.log('📊 CUMULATIVE METRICS (ALL QUEUES)');
  console.log('═'.repeat(60));
  console.log(`📦 Total measured jobs: ${total}`);
  console.log(`⏱️  Avg: ${avg}ms | Min: ${min}ms | Max: ${max}ms`);
  console.log(
    `   P50: ${calculatePercentile(allTimings, 50)}ms | P75: ${calculatePercentile(allTimings, 75)}ms | P90: ${calculatePercentile(allTimings, 90)}ms | P95: ${calculatePercentile(allTimings, 95)}ms | P99: ${calculatePercentile(allTimings, 99)}ms`,
  );
}

function printResults() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL LOAD TEST RESULTS');
  console.log('='.repeat(70));

  const totalTime =
    globalStats.endTime && globalStats.startTime
      ? (globalStats.endTime - globalStats.startTime) / 1000
      : 0;

  console.log(
    `⏱️  Duration: ${totalTime.toFixed(1)}s | 🚀 Throughput: ${(globalStats.totalJobs / totalTime).toFixed(2)} jobs/sec`,
  );
  console.log(
    `✅ Successful: ${globalStats.successful} | ❌ Failed: ${globalStats.failed}`,
  );

  // cumulative first
  printCumulativeStats();

  Object.values(TransformationType).forEach((queue) => {
    const s = queueStats.get(queue);
    if (s && s.totalJobs > 0) printQueueStats(s);
  });

  console.log('\n' + '='.repeat(70));
}

// ##################################################################
// MAIN
// ##################################################################
async function main() {
  const numJobs = parseInt(process.argv[2] || '0', 10);
  if (!numJobs || numJobs < 4 || numJobs > 5000) {
    console.error('Usage: ts-node hacky.test.updated.ts <num-jobs> (4-5000)');
    process.exit(1);
  }

  for (const img of CONFIG.IMAGE_PATHS) {
    if (!fs.existsSync(img.path)) {
      console.error(`Image not found: ${img.path}`);
      process.exit(1);
    }
  }

  initializeQueueStats();
  globalStats.totalJobs = numJobs;
  globalStats.startTime = Date.now();

  const queues = Object.values(TransformationType);
  const jobsPerQueue = Math.floor(numJobs / queues.length);
  const extra = numJobs % queues.length;

  console.log(
    `🚀 Starting ${numJobs} jobs across ${queues.length} queues (${jobsPerQueue}+${extra > 0 ? extra : 0})\n`,
  );

  let sse: CustomSSEClient | null = null;
  try {
    const token = await login();
    sse = initializeSseListener(token);

    const promises: Promise<void>[] = [];
    let counter = 1;

    queues.forEach((queue, i) => {
      const jobsForQueue = jobsPerQueue + (i < extra ? 1 : 0);
      queueStats.get(queue)!.totalJobs = jobsForQueue;
      for (let j = 0; j < jobsForQueue; j++) {
        promises.push(processJob(token, counter++, queue));
      }
    });

    await Promise.allSettled(promises);
    globalStats.endTime = Date.now();

    if (pendingJobs.size > 0) {
      console.log(`\n⚠️  ${pendingJobs.size} jobs timed out`);
      pendingJobs.clear();
    }

    printResults();
  } catch (err: any) {
    console.error('💥 Fatal:', err.message);
  } finally {
    sse?.close();
  }
}

main().catch(console.error);
