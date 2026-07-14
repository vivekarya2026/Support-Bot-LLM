declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(buffer: Buffer | Uint8Array): Promise<{ text: string; numpages: number }>;
  export default pdfParse;
}
