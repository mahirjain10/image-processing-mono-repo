export interface S3Record {
  eventName: string;
  s3: {
    object: {
      key: string;
    };
  };
}
