import { toJpeg } from 'html-to-image';
import download from 'downloadjs';

export async function exportElementAsJpg(elementId: string, filename: string): Promise<boolean> {
  const node = document.getElementById(elementId);
  if (!node) {
    console.error(`Element #${elementId} not found`);
    return false;
  }

  try {
    // Render to high-quality JPEG
    const dataUrl = await toJpeg(node, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      pixelRatio: 2, // crisp high DPI for mobile and printing
      style: {
        borderRadius: '0px',
        boxShadow: 'none',
      }
    });

    const safeFilename = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
    download(dataUrl, safeFilename, 'image/jpeg');
    return true;
  } catch (error) {
    console.error('Error generating JPG image:', error);
    throw error;
  }
}

export function printElement(): void {
  const originalTitle = document.title;
  window.print();
  document.title = originalTitle;
}
