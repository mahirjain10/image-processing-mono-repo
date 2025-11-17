package types

type ImageProcessing struct {
	Id                       string `json:"id"`
	UserId                   string `json:"userId"`
	FileName                 string `json:"fileName"`
	S3RawKey                 string `json:"s3RawKey"`
	PublicUrl                string `json:"publicUrl"`
	Status                   string `json:"status"`
	TransformationType       string `json:"transformationType"`
	TransformationParameters string `json:"transformationParameters"`
	S3PublicUrl              string `json:"s3PublicUrl"`
	CreatedAt                string `json:"createdAt"`
}

type Resize struct {
	Height int `json:"height"`
	Width  int `json:"width"`
}

type Rotate struct {
	Degree int `json:"degree"`
}

type Convert struct {
	Format string `json:"format"`
}
