import * as vision from '@google-cloud/vision';

export class GoogleVisionService {
  private client: vision.ImageAnnotatorClient;

  constructor() {
    // Uses GOOGLE_APPLICATION_CREDENTIALS automatically
    this.client = new vision.ImageAnnotatorClient();
  }

  async extractTextFromImage(imageBuffer: Buffer): Promise<string[]> {
    const [result] = await this.client.annotateImage({
      image: {
        content: imageBuffer.toString('base64'),
      },
      features: [{ type: 'TEXT_DETECTION' }],
    });

    const detections = result.textAnnotations || [];
    if (!detections.length || !detections[0].description) {
      return [];
    }

    return detections[0].description
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
}
