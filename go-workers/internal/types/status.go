package types

// StatusData represents the inner payload
type StatusData struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Status    string `json:"status"`
	PublicURL string `json:"publicUrl"`
	ErrorMsg string `json:"errorMsg"`
}

// StatusMessage represents the full message envelope
type StatusMessage struct {
	Pattern string     `json:"pattern"`
	Data    StatusData `json:"data"`
}


const PROCCESSED = "PROCESSED"
const FAILED = "FAILED"
const PROCESSING = "PROCESSING"