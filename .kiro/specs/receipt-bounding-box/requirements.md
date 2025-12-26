# Requirements Document

## Introduction

This feature enhances the receipt processing system to detect and return the bounding box coordinates of the actual receipt area within an image. This allows cropping out irrelevant parts (such as white margins from A4 scanning) during report generation and preview display.

## Glossary

- **Bounding_Box**: A rectangular region defined by normalized coordinates (0-1000 scale) that identifies the location of a receipt within an image
- **Receipt_Detector**: The component responsible for identifying receipt regions within images
- **Normalized_Coordinates**: Coordinate values scaled to a 0-1000 range, independent of actual image dimensions
- **LLM_Service**: The service that communicates with AI providers (Gemini, OpenRouter, Local) to process images
- **Receipt_Data**: The data structure containing extracted receipt information including bounding box

## Requirements

### Requirement 1: Detect Receipt Bounding Box

**User Story:** As a user, I want the system to detect the actual receipt area in my scanned images, so that irrelevant parts like white margins can be cropped out.

#### Acceptance Criteria

1. WHEN an image is processed for receipt extraction, THE Receipt_Detector SHALL return bounding box coordinates in normalized format (0-1000 scale)
2. THE Bounding_Box SHALL be represented as [ymin, xmin, ymax, xmax] array format
3. WHEN no receipt is detected in the image, THE Receipt_Detector SHALL return null for the bounding box
4. THE Receipt_Detector SHALL include the bounding box data in the ReceiptData response

### Requirement 2: Update LLM Prompt for Bounding Box Detection

**User Story:** As a developer, I want the LLM prompt to request bounding box detection, so that the AI can identify receipt regions in images.

#### Acceptance Criteria

1. WHEN sending a request to the LLM, THE LLM_Service SHALL include instructions to detect the receipt area bounding box
2. THE LLM_Service SHALL request the bounding box in normalized coordinates (0-1000 scale)
3. THE LLM_Service SHALL update the response schema to include the bounding box field

### Requirement 3: Support Bounding Box in Data Types

**User Story:** As a developer, I want the ReceiptData type to include bounding box information, so that it can be used throughout the application.

#### Acceptance Criteria

1. THE ReceiptData interface SHALL include an optional boundingBox field
2. THE boundingBox field SHALL be typed as a tuple of four numbers [ymin, xmin, ymax, xmax] or null
3. WHEN storing receipt data, THE system SHALL persist the bounding box coordinates

### Requirement 4: Display Cropped Receipt in Preview

**User Story:** As a user, I want to see the cropped receipt area in the preview, so that I can verify the correct region was detected.

#### Acceptance Criteria

1. WHEN displaying a receipt preview with bounding box data, THE system SHALL show the cropped receipt area
2. WHEN no bounding box is available, THE system SHALL display the full original image
3. THE system SHALL provide a way to toggle between cropped and full image views

### Requirement 5: Use Cropped Image in Reports

**User Story:** As a user, I want my generated reports to use the cropped receipt images, so that reports look clean without unnecessary margins.

#### Acceptance Criteria

1. WHEN generating a report with bounding box data, THE system SHALL use the cropped receipt image
2. WHEN no bounding box is available, THE system SHALL use the full original image
3. THE cropping SHALL be applied during report generation (PDF, HTML, Excel)
