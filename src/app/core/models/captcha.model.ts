export interface CaptchaChallenge {
  challengeId: string;
  /** A PNG, already base64-encoded. Render with `data:image/png;base64,`. */
  imageBase64: string;
  expiresInSeconds: number;
}
