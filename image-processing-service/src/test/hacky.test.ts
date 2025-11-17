/**
 * Load Testing Script (End-to-End, Hybrid SSE + GET)
 *
 * This script gets the *final* job status via SSE, then
 * makes a separate HTTP call to fetch the processed URL.
 *
 * USAGE:
 * 1. npm install eventsource
 * 2. npm install -D @types/eventsource
 * 3. ts-node load-test.ts <num-jobs>
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { EventSource } from 'eventsource';

// ##################################################################
// CONFIGURATION
// ##################################################################
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  SSE_UPDATES_URL: 'http://localhost:3000/status', // Your SSE endpoint

  // ---

  USERNAME: 'test@gmail.com',
  PASSWORD: 'mahirjain30@',
  REQUEST_TIMEOUT_MS: 60000,
  JOB_COMPLETION_TIMEOUT_MS: 120000,
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

// This must match the `STATUS` enum in your backend
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
    id: string; // The Job ID
    filename: string;
  };
}

// --- UPDATED: Matches your StatusMessage ---
interface SseMessageData {
  jobId: string;
  status: ProcessingStatus;
  type: string; // e.g., 'status'
  userId: string;
  errorMsg: string | null;
}

// --- NEW: Response from the GET /upload/status/:id call ---
interface JobStatusResponse {
  // --- ASSUMING THIS STRUCTURE ---
  message: string;
  data: {
    id: string;
    status: ProcessingStatus;
    processedUrl?: string; // This is what we need
  };
}
// ##################################################################

// Map to hold promises for pending jobs
const pendingJobs = new Map<
  string,
  {
    resolve: () => void; // Resolves with no value
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
    jobNumber: number;
    errorMsg?: string | null; // Store error from SSE
  }
>();

// Stats tracking
const stats = {
  totalJobs: 0,
  successful: 0,
  failed: 0,
  startTime: null as number | null,
  endTime: null as null | number,
  jobTimings: [] as number[],
  errors: [] as any[],
};

// Helper: Make HTTP request
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
      res.on('data', (chunk) => {
        data += chunk;
      });
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

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Helper: Extract token
function extractToken(cookies: string[] | undefined): string | null {
  if (!cookies) return null;
  for (const cookie of cookies) {
    const match = cookie.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

// Helper: Upload file to S3
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
      (res) => {
        resolve(res.statusCode || 0);
      },
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

// Helper: Get random transformation
function getRandomTransformation(): Omit<
  UploadUrlPayload,
  'filename' | 'mimeType'
> {
  const types: TransformationType[] = [
    TransformationType.RESIZE,
    TransformationType.FORCE_RESIZE,
    TransformationType.ROTATE,
    TransformationType.CONVERT,
  ];
  const type = types[Math.floor(Math.random() * types.length)];

  switch (type) {
    case TransformationType.RESIZE:
      return {
        transformationType: TransformationType.RESIZE,
        transformationParamters: { width: 800, height: 600 },
      };
    case TransformationType.FORCE_RESIZE:
      return {
        transformationType: TransformationType.FORCE_RESIZE,
        transformationParamters: { width: 700, height: 700 },
      };
    case TransformationType.ROTATE:
      const degrees: RotationDegree[] = [90, 180, 270];
      return {
        transformationType: TransformationType.ROTATE,
        transformationParamters: {
          degree: degrees[Math.floor(Math.random() * degrees.length)],
        },
      };
    case TransformationType.CONVERT:
    default:
      const formats: SupportedFormat[] = ['PNG', 'JPEG', 'GIF', 'BMP', 'TIFF'];
      return {
        transformationType: TransformationType.CONVERT,
        transformationParamters: {
          format: formats[Math.floor(Math.random() * formats.length)],
        },
      };
  }
}

// Step 1: Login
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
  if (!token) {
    throw new Error('No token received from login');
  }

  console.log('✅ Login successful');
  return token;
}

// Step 2: Get presigned URL
async function getUploadUrl(
  token: string,
  payload: UploadUrlPayload,
): Promise<{ presignedUrl: string; id: string }> {
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
      `Upload URL request failed: ${response.statusCode} - ${response.body}`,
    );
  }

  const data = JSON.parse(response.body) as UploadUrlResponse;

  if (!data.data.preSignedUrl || !data.data.id) {
    throw new Error(
      `API Error: Missing preSignedUrl or id in response: ${response.body}`,
    );
  }

  return {
    presignedUrl: data.data.preSignedUrl,
    id: data.data.id,
  };
}

// Custom SSE client that supports authentication headers
class CustomSSEClient {
  private url: URL;
  private headers: Record<string, string>;
  private abortController: AbortController;
  private isRunning = false;

  constructor(url: string, token: string) {
    this.url = new URL(url);
    this.headers = {
      'Cookie': `token=${token}`,
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
    this.abortController = new AbortController();
  }

  async connect(): Promise<void> {
    const urlObj = new URL(this.url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const reqOptions: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: this.headers,
        signal: this.abortController.signal,
      };

      const req = client.request(reqOptions, (res) => {
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
              if (data) {
                this.handleMessage(data);
              }
            }
          }
        });

        res.on('end', () => {
          this.isRunning = false;
        });
      });

      req.on('error', (err) => {
        console.error('❌ SSE Connection Error:', err);
        // Don't reject immediately, let the caller handle reconnection
        if (!this.isRunning) {
          reject(err);
        }
      });

      req.end();
    });
  }

  private handleMessage(data: string): void {
    let parsedData: SseMessageData;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      console.error('SSE Error: Could not parse message data:', data);
      return;
    }

    // Only look at 'status' type messages
    if (parsedData.type !== 'status' || !parsedData.jobId) {
      return;
    }

    const job = pendingJobs.get(parsedData.jobId);
    if (job) {
      // Stop the timeout
      clearTimeout(job.timeout);

      if (parsedData.status === ProcessingStatus.PROCESSED) {
        job.resolve();
      } else if (parsedData.status === ProcessingStatus.FAILED) {
        job.reject(
          new Error(parsedData.errorMsg || 'Job failed with no error message'),
        );
      }

      // Remove from map only on final status
      if (
        parsedData.status === ProcessingStatus.PROCESSED ||
        parsedData.status === ProcessingStatus.FAILED
      ) {
        pendingJobs.delete(parsedData.jobId);
      }
    }
  }

  close(): void {
    this.abortController.abort();
    this.isRunning = false;
  }
}

// --- UPDATED Step 3 ---
// Listen for updates from the server
function initializeSseListener(token: string): CustomSSEClient {
  console.log(`🎧 Listening for job updates at ${CONFIG.SSE_UPDATES_URL}`);

  const sse = new CustomSSEClient(CONFIG.SSE_UPDATES_URL, token);
  
  // Start the connection
  sse.connect().catch((err) => {
    console.error('❌ Failed to establish SSE connection:', err);
  });

  return sse;
}

// --- UPDATED Step 4 ---
// Wait for a job to complete (just waits for the SSE, doesn't return URL)
async function waitForJobSse(jobId: string, jobNumber: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Job ${jobNumber} (ID: ${jobId}) timed out waiting for SSE after ${
            CONFIG.JOB_COMPLETION_TIMEOUT_MS / 1000
          }s`,
        ),
      );
      pendingJobs.delete(jobId);
    }, CONFIG.JOB_COMPLETION_TIMEOUT_MS);

    pendingJobs.set(jobId, { resolve, reject, timeout, jobNumber });
  });
}


// --- UPDATED Step 6 ---
// Process single job (end-to-end)
async function processJob(token: string, jobNumber: number): Promise<void> {
  const jobStartTime = Date.now();
  let jobId: string | null = null;

  try {
    const selectedImage =
      CONFIG.IMAGE_PATHS[Math.floor(Math.random() * CONFIG.IMAGE_PATHS.length)];
    const { path: imagePath, contentType } = selectedImage;
    const extension = path.extname(imagePath);
    const transformation = getRandomTransformation();
    const sourceFileName = `test-job-${jobNumber}-${Date.now()}${extension}`;

    const payload: UploadUrlPayload = {
      filename: sourceFileName,
      mimeType: contentType,
      ...transformation,
    };

    // 1. Get Upload URL
    console.log(
      `📤 Job ${jobNumber}: Requesting ${payload.transformationType} on ${path.basename(
        imagePath,
      )}`,
    );
    const { presignedUrl, id } = await getUploadUrl(token, payload);
    jobId = id;

    // 2. Upload to S3
    console.log(`📤 Job ${jobNumber}: Uploading to S3... (Job ID: ${jobId})`);
    const uploadStatus = await uploadToS3(presignedUrl, imagePath, contentType);

    if (uploadStatus !== 200) {
      throw new Error(`S3 upload failed with status ${uploadStatus}`);
    }

    // 3. Wait for SSE message
    console.log(
      `⏳ Job ${jobNumber}: Upload complete. Waiting for SSE event...`,
    );
    await waitForJobSse(jobId, jobNumber); // This resolves on PROCESSED

    // 4. Success - SSE already confirmed the job is processed
    const duration = Date.now() - jobStartTime;
    stats.successful++;
    stats.jobTimings.push(duration);
    console.log(
      `✅ Job ${jobNumber}: SUCCESS (Processed) in ${duration}ms`,
    );
  } catch (error: any) {
    const duration = Date.now() - jobStartTime;
    stats.failed++;
    stats.errors.push({ job: jobNumber, id: jobId, error: error.message });
    stats.jobTimings.push(duration);
    console.log(`❌ Job ${jobNumber} (ID: ${jobId}): ERROR - ${error.message}`);

    if (jobId) {
      const job = pendingJobs.get(jobId);
      if (job) {
        clearTimeout(job.timeout);
        pendingJobs.delete(jobId);
      }
    }
  }
}

// Calculate percentiles
function calculatePercentile(arr: number[], percentile: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// Print results
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST RESULTS (Hybrid SSE + GET)');
  console.log('='.repeat(60));

  if (!stats.startTime || !stats.endTime) {
    console.log('Test did not run long enough to gather stats.');
    return;
  }

  const totalTime = (stats.endTime - stats.startTime) / 1000;
  const successRate = ((stats.successful / stats.totalJobs) * 100).toFixed(2);
  const jobsPerSecond = (stats.totalJobs / totalTime).toFixed(2);

  console.log(`\n⏱️  Total Duration: ${totalTime.toFixed(2)}s`);
  console.log(`📦 Total Jobs: ${stats.totalJobs}`);
  console.log(`🚀 Jobs Per Second (Avg): ${jobsPerSecond}`);
  console.log(`✅ Successful: ${stats.successful} (${successRate}%)`);
  console.log(`❌ Failed: ${stats.failed}`);

  if (stats.jobTimings.length > 0) {
    const avgTime = (
      stats.jobTimings.reduce((a, b) => a + b, 0) / stats.jobTimings.length
    ).toFixed(2);
    const minTime = Math.min(...stats.jobTimings);
    const maxTime = Math.max(...stats.jobTimings);

    console.log(`\n⏱️  Timing Statistics (ms) - (End-to-End Processing):`);
    console.log(`   Average: ${avgTime}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log(`   P50: ${calculatePercentile(stats.jobTimings, 50)}ms`);
    console.log(`   P75: ${calculatePercentile(stats.jobTimings, 75)}ms`); // This was the line with the 'Sizelog' typo
    console.log(`   P90: ${calculatePercentile(stats.jobTimings, 90)}ms`);
    console.log(`   P95: ${calculatePercentile(stats.jobTimings, 95)}ms`);
    console.log(`   P99: ${calculatePercentile(stats.jobTimings, 99)}ms`);
  }

  if (stats.errors.length > 0) {
    console.log(`\n❌ Error Details:`);
    const errorMap = new Map<string, number>();
    stats.errors.forEach((err) => {
      const msg = err.error || 'Unknown Error';
      errorMap.set(msg, (errorMap.get(msg) || 0) + 1);
    });

    errorMap.forEach((count, error) => {
      console.log(`   (${count}x) ${error}`);
    });
  }
  console.log('\n' + '='.repeat(60));
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: ts-node load-test.ts <num-jobs>');
    console.error('Example: ts-node load-test.ts 50');
    process.exit(1);
  }
  const numJobs = parseInt(args[0], 10);
  for (const img of CONFIG.IMAGE_PATHS) {
    if (!fs.existsSync(img.path)) {
      console.error(`Error: Image file not found: ${img.path}`);
      console.error(
        'Please update the IMAGE_PATHS list at the top of the script.',
      );
      process.exit(1);
    }
  }
  if (isNaN(numJobs) || numJobs < 1 || numJobs > 5000) {
    console.error('Error: Number of jobs must be between 1 and 5000');
    process.exit(1);
  }

  console.log('🚀 Starting Load Test');
  console.log(`🔢 Jobs: ${numJobs} (running in parallel)`);
  console.log(
    `⌛ Job Timeout: ${CONFIG.JOB_COMPLETION_TIMEOUT_MS / 1000}s per job`,
  );
  console.log('');

  stats.totalJobs = numJobs;
  stats.startTime = Date.now();
  let sse: CustomSSEClient | null = null;

  try {
    const token = await login();
    sse = initializeSseListener(token);

    console.log('\n🔄 Processing jobs (in parallel)...\n');

    // --- FIX 2: Explicitly type the array ---
    const jobPromises: Promise<void>[] = [];

    for (let i = 1; i <= numJobs; i++) {
      jobPromises.push(processJob(token, i));
    }

    await Promise.allSettled(jobPromises);

    stats.endTime = Date.now();

    if (pendingJobs.size > 0) {
      console.log(
        `\n⚠️  ${pendingJobs.size} jobs never received an SSE event and were marked as failed by timeout.`,
      );
      pendingJobs.clear();
    }

    printResults();
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message);
  } finally {
    if (sse) {
      console.log('\n🔌 Closing SSE connection.');
      sse.close();
    }
    process.exit();
  }
}

// Run the script
main().catch(console.error);
