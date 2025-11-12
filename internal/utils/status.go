package utils

import "github.com/mahirjain10/go-workers/internal/types"

const pattern = "status"
func InitStatusData(id string,userId string,status string,publicUrl string,errorMsg string) *types.StatusData {
	return &types.StatusData{ID: id,UserID: userId,Status: status,PublicURL:publicUrl,ErrorMsg: errorMsg }
}
func InitStatusMessage(data *types.StatusData) *types.StatusMessage {
	return &types.StatusMessage{Pattern: pattern,Data: *data}
}