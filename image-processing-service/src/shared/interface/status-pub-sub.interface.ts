import { STATUS } from '@src/upload/constants/upload.constants';

export interface StatusMessage {
  status: STATUS;
  userId: string;
  type: PUB_SUB_TYPE;
  jobId: string;
  errorMsg: string | null;
}
type PUB_SUB_TYPE = 'status';
export const NOTIFICATION_CHANNEL = 'notification' as const;
export const STATUS_TYPE = 'status' as const;
