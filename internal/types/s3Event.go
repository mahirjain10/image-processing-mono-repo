package types

type S3Event struct {
	Pattern string      `json:"pattern"`
	Data    []EventData `json:"data"`
}

type EventData struct {
	S3 struct {
		Object S3ObjectDetails `json:"object"`
	} `json:"s3"`
}

type S3ObjectDetails struct {
	Key       string `json:"key"`
	Size      int64  `json:"size"`
	ETag      string `json:"eTag"`
	Sequencer string `json:"sequencer"`
}
