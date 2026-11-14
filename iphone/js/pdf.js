// pdf.js, loaded only when a PDF is needed (it is big).
let lib;

export async function pdfjs() {
  if (!lib) {
    lib = await import('../lib/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.min.mjs', import.meta.url).href;
  }
  return lib;
}

/** Blob → pdf.js document. Call .destroy() when done. */
export async function openPdf(blob) {
  const { getDocument } = await pdfjs();
  return getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
}
