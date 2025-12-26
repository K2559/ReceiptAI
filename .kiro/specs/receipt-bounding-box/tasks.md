# Implementation Plan: Receipt Bounding Box Detection

## Overview

This plan implements bounding box detection for receipts, enabling cropping of irrelevant margins during preview and report generation. The implementation follows a bottom-up approach: types first, then utilities, then service updates, and finally UI integration.

## Tasks

- [x] 1. Add BoundingBox type definitions
  - Add BoundingBox type alias to types.ts
  - Update ReceiptData interface to include optional boundingBox field
  - _Requirements: 3.1, 3.2_

- [x] 2. Create image cropping utility
  - [x] 2.1 Create utils/imageCropUtils.ts with cropImageByBoundingBox function
    - Implement canvas-based cropping using normalized coordinates
    - Handle padding option for extra margin around crop area
    - _Requirements: 4.1, 5.1_
  - [x] 2.2 Implement isValidBoundingBox validation function
    - Validate array length is 4
    - Validate all values are numbers in range [0, 1000]
    - Validate ymin < ymax and xmin < xmax
    - _Requirements: 1.1, 1.2_
  - [ ]* 2.3 Write property test for bounding box validation
    - **Property 1: Bounding Box Coordinate Validity**
    - **Validates: Requirements 1.1, 1.2**
  - [ ]* 2.4 Write property test for cropping dimensions
    - **Property 4: Cropping Produces Valid Dimensions**
    - **Validates: Requirements 4.1, 5.1, 5.3**

- [x] 3. Update settings service with bounding box prompt
  - [x] 3.1 Update DEFAULT_PROMPT to include bounding box detection instructions
    - Add instructions for normalized coordinates (0-1000 scale)
    - Specify [ymin, xmin, ymax, xmax] format
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Update DEFAULT_SCHEMA to include boundingBox field
    - Add boundingBox property with array type
    - Set minItems/maxItems to 4
    - _Requirements: 2.3_

- [x] 4. Checkpoint - Verify core utilities work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update LLM service response handling
  - [x] 5.1 Update receiptSchema in geminiService.ts to include boundingBox
    - Add boundingBox property to schema
    - _Requirements: 2.3_
  - [x] 5.2 Ensure boundingBox is included in ReceiptData response
    - Map parsed boundingBox to response object
    - Handle null/missing boundingBox gracefully
    - _Requirements: 1.3, 1.4_
  - [ ]* 5.3 Write property test for bounding box structure integrity
    - **Property 2: Bounding Box Structure Integrity**
    - **Validates: Requirements 1.2, 1.4, 3.1, 3.2**

- [x] 6. Update storage service for bounding box persistence
  - [x] 6.1 Verify IndexedDB service handles boundingBox field
    - Ensure boundingBox is stored and retrieved correctly
    - _Requirements: 3.3_
  - [ ]* 6.2 Write property test for persistence round-trip
    - **Property 3: Bounding Box Persistence Round-Trip**
    - **Validates: Requirements 3.3**

- [x] 7. Checkpoint - Verify data flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update preview display with cropping
  - [x] 8.1 Create a CroppedImage component or update existing image display
    - Use cropImageByBoundingBox when boundingBox is available
    - Fall back to full image when boundingBox is null
    - _Requirements: 4.1, 4.2_
  - [x] 8.2 Add toggle for cropped/full image view
    - Add state for view mode
    - Add toggle button/switch
    - _Requirements: 4.3_

- [x] 9. Update report generators with cropping
  - [x] 9.1 Update htmlReportUtils.ts to use cropped images
    - Apply cropping before embedding in HTML
    - Fall back to full image when no boundingBox
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 9.2 Update pdfUtils.ts to use cropped images
    - Apply cropping before adding to PDF
    - Fall back to full image when no boundingBox
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 10. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The bounding box uses normalized coordinates (0-1000) for device independence
- Cropping is done client-side using canvas for performance
- Property tests use fast-check library for TypeScript
