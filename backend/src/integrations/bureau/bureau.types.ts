export interface BureauResult {
  success: boolean;
  score: number | null;
  requestXml?: string | null;
  response?: string | null;
  error?: string | null;
}
