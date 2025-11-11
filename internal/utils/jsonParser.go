package utils

import (
	"encoding/json"
	"fmt"
)

func ParseJSON(data []byte, v any) error {
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}
	return nil
}

func SerializeJSON(data map[string]string) ([]byte, error) {
	value, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return value, err
}
