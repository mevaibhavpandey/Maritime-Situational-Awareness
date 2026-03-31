/**
 * OCR Module using Tesseract.js
 * Handles OCR processing for maritime documents
 */

/**
 * Process OCR using Tesseract.js
 * @param {File} file - Image or PDF file
 * @returns {Promise<string>} Extracted text
 */
export async function processOCRWithSarvam(file) {
    try {
        // Check if file is an image
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'];
        if (!validImageTypes.includes(file.type)) {
            throw new Error(`Unsupported file type: ${file.type}. Please use JPG, PNG, WEBP, or BMP images.`);
        }

        // Create image URL from file
        const imageUrl = URL.createObjectURL(file);

        // Process with Tesseract.js
        console.log('Starting OCR processing with Tesseract.js...');
        
        const result = await Tesseract.recognize(
            imageUrl,
            'eng',
            {
                logger: info => {
                    // Log progress
                    if (info.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
                    }
                }
            }
        );

        // Clean up the object URL
        URL.revokeObjectURL(imageUrl);

        const extractedText = result.data.text;

        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error("No text could be extracted from the image. Please ensure the image contains readable text.");
        }

        console.log('OCR completed successfully');
        return extractedText;

    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error(`OCR processing failed: ${error.message}`);
    }
}
